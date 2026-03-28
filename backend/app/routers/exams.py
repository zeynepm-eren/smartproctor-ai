"""
SmartProctor - Sınav Yönetimi Router
+ Soru silme/düzenleme
+ Sınav silme
+ Otomatik rastgele gözetmen ataması (2 kişi)
+ max_tab_switches kaldırıldı
"""

from typing import List
from datetime import datetime, timezone
import random
import logging
import os
import uuid
import base64
import xml.etree.ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.exam import Exam, Question, Option, ExamStatus
from app.models.course import Course, CourseEnrollment
from app.models.proctor import ProctorAssignment
from app.schemas.exam import (
    ExamCreate, ExamUpdate, ExamResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionResponseStudent,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exams", tags=["Sınavlar"])


def determine_exam_status(start_time, end_time) -> ExamStatus:
    now = datetime.now(timezone.utc)
    if start_time and end_time:
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        if now < start_time:
            return ExamStatus.scheduled
        elif start_time <= now <= end_time:
            return ExamStatus.active
        else:
            return ExamStatus.completed
    return ExamStatus.draft


async def assign_random_proctors(exam_id: int, db: AsyncSession, count: int = 2):
    """Sınava rastgele 2 gözetmen ata."""
    result = await db.execute(
        select(User).where(User.role == UserRole.proctor, User.is_active == True)
    )
    all_proctors = result.scalars().all()
    if len(all_proctors) == 0:
        return []

    selected = random.sample(all_proctors, min(count, len(all_proctors)))
    assignments = []
    for proctor in selected:
        existing = await db.execute(
            select(ProctorAssignment).where(
                ProctorAssignment.exam_id == exam_id,
                ProctorAssignment.proctor_id == proctor.id
            )
        )
        if not existing.scalar_one_or_none():
            assignment = ProctorAssignment(exam_id=exam_id, proctor_id=proctor.id)
            db.add(assignment)
            assignments.append(assignment)
    await db.flush()
    return assignments


@router.get("/", response_model=List[ExamResponse])
async def list_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcı rolüne göre sınav listesi."""
    if current_user.role.value == "instructor":
        result = await db.execute(
            select(Exam)
            .join(Course, Course.id == Exam.course_id)
            .where(Course.instructor_id == current_user.id)
            .options(selectinload(Exam.questions))
        )
    elif current_user.role.value == "student":
        enrollment_result = await db.execute(
            select(CourseEnrollment).where(CourseEnrollment.student_id == current_user.id)
        )
        enrollments = enrollment_result.scalars().all()
        if not enrollments:
            return []
        enrolled_course_ids = [e.course_id for e in enrollments]
        result = await db.execute(
            select(Exam)
            .where(
                Exam.course_id.in_(enrolled_course_ids),
                Exam.status.in_([ExamStatus.scheduled, ExamStatus.active]),
            )
            .options(selectinload(Exam.questions), selectinload(Exam.course))
        )
    else:
        result = await db.execute(
            select(Exam)
            .join(ProctorAssignment, ProctorAssignment.exam_id == Exam.id)
            .where(ProctorAssignment.proctor_id == current_user.id)
            .options(selectinload(Exam.questions))
        )

    exams = result.scalars().unique().all()

    response = []
    for exam in exams:
        new_status = determine_exam_status(exam.start_time, exam.end_time)
        if exam.status != new_status and exam.status != ExamStatus.cancelled:
            exam.status = new_status
        resp = ExamResponse.model_validate(exam)
        resp.question_count = len(exam.questions)
        response.append(resp)

    await db.flush()
    return response


@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    req: ExamCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Yeni sınav oluşturur ve otomatik 2 gözetmen atar."""
    result = await db.execute(
        select(Course).where(Course.id == req.course_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu ders size ait değil")

    initial_status = determine_exam_status(req.start_time, req.end_time)
    exam_data = req.model_dump()
    exam_data['status'] = initial_status

    exam = Exam(**exam_data)
    db.add(exam)
    await db.flush()
    await db.refresh(exam)

    # Her sınava otomatik 2 gözetmen ata
    await assign_random_proctors(exam.id, db, count=2)
    await db.flush()
    return exam


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id).options(selectinload(Exam.questions))
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")
    new_status = determine_exam_status(exam.start_time, exam.end_time)
    if exam.status != new_status and exam.status != ExamStatus.cancelled:
        exam.status = new_status
        await db.flush()
    resp = ExamResponse.model_validate(exam)
    resp.question_count = len(exam.questions)
    return resp


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: int,
    req: ExamUpdate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    update_data = req.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = ExamStatus(update_data["status"])
    for field, value in update_data.items():
        setattr(exam, field, value)

    if "start_time" in update_data or "end_time" in update_data:
        if "status" not in update_data:
            exam.status = determine_exam_status(exam.start_time, exam.end_time)

    await db.flush()
    await db.refresh(exam)
    return exam


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: int,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınavı siler (cascade ile sorular ve oturumlar da silinir)."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")
    await db.execute(sql_delete(Exam).where(Exam.id == exam_id))
    await db.flush()
    return {"message": "Sınav silindi"}


# --- Sorular ---
@router.post("/{exam_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    exam_id: int,
    req: QuestionCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    question = Question(
        exam_id=exam_id, question_type=req.question_type, body=req.body,
        image_url=req.image_url, points=req.points, sort_order=req.sort_order,
        explanation=req.explanation,
    )
    db.add(question)
    await db.flush()

    for opt_data in req.options:
        option = Option(
            question_id=question.id, body=opt_data.body,
            is_correct=opt_data.is_correct, sort_order=opt_data.sort_order,
        )
        db.add(option)

    await db.flush()
    result = await db.execute(
        select(Question).where(Question.id == question.id).options(selectinload(Question.options))
    )
    return result.scalar_one()


@router.put("/{exam_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    exam_id: int,
    question_id: int,
    req: QuestionUpdate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Soruyu günceller."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
        .options(selectinload(Question.options))
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")

    update_data = req.model_dump(exclude_unset=True)
    options_data = update_data.pop("options", None)

    for field, value in update_data.items():
        setattr(question, field, value)

    if options_data is not None:
        # Eski seçenekleri sil, yenilerini ekle
        await db.execute(sql_delete(Option).where(Option.question_id == question_id))
        for opt_data in options_data:
            option = Option(
                question_id=question_id, body=opt_data["body"],
                is_correct=opt_data.get("is_correct", False),
                sort_order=opt_data.get("sort_order", 0),
            )
            db.add(option)

    await db.flush()
    result = await db.execute(
        select(Question).where(Question.id == question_id).options(selectinload(Question.options))
    )
    return result.scalar_one()


@router.delete("/{exam_id}/questions/{question_id}")
async def delete_question(
    exam_id: int,
    question_id: int,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Soruyu siler."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")

    await db.delete(question)
    await db.flush()
    return {"message": "Soru silindi"}


@router.get("/{exam_id}/questions", response_model=List[QuestionResponse])
async def list_questions(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Question).where(Question.exam_id == exam_id)
        .options(selectinload(Question.options)).order_by(Question.sort_order)
    )
    return result.scalars().unique().all()


@router.get("/{exam_id}/questions/student", response_model=List[QuestionResponseStudent])
async def list_questions_student(
    exam_id: int,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Question).where(Question.exam_id == exam_id)
        .options(selectinload(Question.options)).order_by(Question.sort_order)
    )
    return result.scalars().unique().all()


@router.post("/{exam_id}/questions/upload-image")
async def upload_question_image(
    exam_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Soru için görsel yükler, URL döndürür."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="Sadece resim dosyaları yüklenebilir (png, jpg, gif, webp)")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "questions")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"q_{exam_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    image_url = f"/evidence/questions/{filename}"
    return {"image_url": image_url}


@router.post("/{exam_id}/questions/upload-xml", response_model=List[QuestionResponse])
async def upload_questions_xml(
    exam_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """XML dosyasından toplu soru yükler (test, klasik, görselli)."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Sadece .xml dosyası yüklenebilir")

    try:
        content = await file.read()
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"XML parse hatası: {str(e)}")

    existing = await db.execute(
        select(func.count(Question.id)).where(Question.exam_id == exam_id)
    )
    sort_start = (existing.scalar() or 0) + 1

    upload_dir = os.path.join(settings.UPLOAD_DIR, "questions")
    os.makedirs(upload_dir, exist_ok=True)

    created_questions = []
    for idx, q_elem in enumerate(root.findall("question")):
        q_type = q_elem.get("type", "multiple_choice")
        if q_type not in ("multiple_choice", "true_false", "open_ended"):
            q_type = "multiple_choice"

        points = float(q_elem.get("points", "1"))

        body_elem = q_elem.find("body")
        if body_elem is None or not (body_elem.text or "").strip():
            raise HTTPException(status_code=400, detail=f"Soru {idx+1}: body alanı boş olamaz")

        explanation_elem = q_elem.find("explanation")
        explanation = explanation_elem.text.strip() if explanation_elem is not None and explanation_elem.text else None

        # Görsel işleme (base64 veya URL)
        image_url = None
        image_elem = q_elem.find("image")
        if image_elem is not None and image_elem.text and image_elem.text.strip():
            img_data = image_elem.text.strip()
            if img_data.startswith("data:image/"):
                # Base64 görsel — dosyaya kaydet
                try:
                    header, b64 = img_data.split(",", 1)
                    ext = ".png"
                    if "jpeg" in header or "jpg" in header:
                        ext = ".jpg"
                    elif "gif" in header:
                        ext = ".gif"
                    elif "webp" in header:
                        ext = ".webp"
                    filename = f"q_{exam_id}_{uuid.uuid4().hex[:8]}{ext}"
                    filepath = os.path.join(upload_dir, filename)
                    with open(filepath, "wb") as f:
                        f.write(base64.b64decode(b64))
                    image_url = f"/evidence/questions/{filename}"
                except Exception:
                    pass  # Görsel çözülemezse atla
            else:
                image_url = img_data  # URL olarak kaydet

        question = Question(
            exam_id=exam_id, question_type=q_type, body=body_elem.text.strip(),
            image_url=image_url, points=points, sort_order=sort_start + idx,
            explanation=explanation,
        )
        db.add(question)
        await db.flush()

        # open_ended sorularda seçenek zorunlu değil
        options_elem = q_elem.find("options")
        if q_type == "open_ended":
            if options_elem is not None:
                for o_idx, opt_elem in enumerate(options_elem.findall("option")):
                    opt_body = (opt_elem.text or "").strip()
                    if opt_body:
                        option = Option(
                            question_id=question.id, body=opt_body,
                            is_correct=True, sort_order=o_idx + 1,
                        )
                        db.add(option)
        else:
            if options_elem is None:
                raise HTTPException(status_code=400, detail=f"Soru {idx+1}: test soruları için options alanı gerekli")
            has_correct = False
            for o_idx, opt_elem in enumerate(options_elem.findall("option")):
                is_correct = opt_elem.get("correct", "false").lower() == "true"
                if is_correct:
                    has_correct = True
                opt_body = (opt_elem.text or "").strip()
                if not opt_body:
                    raise HTTPException(status_code=400, detail=f"Soru {idx+1}, Seçenek {o_idx+1}: boş olamaz")
                option = Option(
                    question_id=question.id, body=opt_body,
                    is_correct=is_correct, sort_order=o_idx + 1,
                )
                db.add(option)
            if not has_correct:
                raise HTTPException(status_code=400, detail=f"Soru {idx+1}: en az bir doğru cevap olmalı")

        created_questions.append(question)

    if not created_questions:
        raise HTTPException(status_code=400, detail="XML dosyasında soru bulunamadı")

    await db.flush()

    q_ids = [q.id for q in created_questions]
    result = await db.execute(
        select(Question).where(Question.id.in_(q_ids))
        .options(selectinload(Question.options)).order_by(Question.sort_order)
    )
    return result.scalars().unique().all()


@router.get("/{exam_id}/questions/export-xml")
async def export_questions_xml(
    exam_id: int,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınav sorularını XML olarak dışa aktarır (indirme)."""
    result = await db.execute(
        select(Exam).join(Course).where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    result = await db.execute(
        select(Question).where(Question.exam_id == exam_id)
        .options(selectinload(Question.options)).order_by(Question.sort_order)
    )
    questions = result.scalars().unique().all()

    root = ET.Element("questions")
    root.set("exam_title", exam.title)

    for q in questions:
        q_elem = ET.SubElement(root, "question")
        q_elem.set("type", q.question_type.value if hasattr(q.question_type, 'value') else q.question_type)
        q_elem.set("points", str(float(q.points)))

        body_elem = ET.SubElement(q_elem, "body")
        body_elem.text = q.body

        if q.image_url:
            image_elem = ET.SubElement(q_elem, "image")
            # Görsel dosyayı base64'e çevir
            img_path = q.image_url
            if img_path.startswith("/evidence/"):
                file_path = os.path.join("static", img_path.replace("/evidence/", ""))
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        img_bytes = f.read()
                    ext = os.path.splitext(file_path)[1].lower()
                    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif", "webp": "webp"}
                    mime_type = mime.get(ext.lstrip("."), "png")
                    image_elem.text = f"data:image/{mime_type};base64,{base64.b64encode(img_bytes).decode()}"
                else:
                    image_elem.text = img_path
            else:
                image_elem.text = img_path

        if q.explanation:
            exp_elem = ET.SubElement(q_elem, "explanation")
            exp_elem.text = q.explanation

        if q.options:
            opts_elem = ET.SubElement(q_elem, "options")
            for opt in sorted(q.options, key=lambda o: o.sort_order):
                opt_elem = ET.SubElement(opts_elem, "option")
                if opt.is_correct:
                    opt_elem.set("correct", "true")
                opt_elem.text = opt.body

    ET.indent(root, space="  ")
    xml_str = ET.tostring(root, encoding="unicode", xml_declaration=True)

    safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in exam.title)
    filename = f"{safe_title}_sorular.xml"

    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
