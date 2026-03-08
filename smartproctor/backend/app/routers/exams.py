"""
SmartProctor - Sınav Yönetimi Router
Sınav CRUD, soru ekleme ve sınav bilgilerini getirme.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.exam import Exam, Question, Option, ExamStatus
from app.models.course import Course, CourseEnrollment
from app.schemas.exam import (
    ExamCreate, ExamUpdate, ExamResponse,
    QuestionCreate, QuestionResponse, QuestionResponseStudent,
)

router = APIRouter(prefix="/api/exams", tags=["Sınavlar"])


@router.get("/", response_model=List[ExamResponse])
async def list_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcı rolüne göre sınav listesi döndürür."""
    if current_user.role.value == "instructor":
        result = await db.execute(
            select(Exam)
            .join(Course, Course.id == Exam.course_id)
            .where(Course.instructor_id == current_user.id)
            .options(selectinload(Exam.questions))
        )
    elif current_user.role.value == "student":
        result = await db.execute(
            select(Exam)
            .join(Course, Course.id == Exam.course_id)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(
                CourseEnrollment.student_id == current_user.id,
                Exam.status.in_([ExamStatus.scheduled, ExamStatus.active]),
            )
            .options(selectinload(Exam.questions))
        )
    else:
        # Gözetmen: atandığı sınavlar
        from app.models.proctor import ProctorAssignment
        result = await db.execute(
            select(Exam)
            .join(ProctorAssignment, ProctorAssignment.exam_id == Exam.id)
            .where(ProctorAssignment.proctor_id == current_user.id)
            .options(selectinload(Exam.questions))
        )

    exams = result.scalars().unique().all()
    response = []
    for exam in exams:
        resp = ExamResponse.model_validate(exam)
        resp.question_count = len(exam.questions)
        response.append(resp)
    return response


@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    req: ExamCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Yeni sınav oluşturur (sadece eğitmen)."""
    # Ders sahiplik kontrolü
    result = await db.execute(
        select(Course).where(Course.id == req.course_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu ders size ait değil")

    exam = Exam(**req.model_dump())
    db.add(exam)
    await db.flush()
    await db.refresh(exam)
    return exam


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sınav detayını döndürür."""
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id).options(selectinload(Exam.questions))
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

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
    """Sınav bilgilerini günceller."""
    result = await db.execute(
        select(Exam)
        .join(Course, Course.id == Exam.course_id)
        .where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    update_data = req.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = ExamStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(exam, field, value)

    await db.flush()
    await db.refresh(exam)
    return exam


# --- Sorular ---
@router.post("/{exam_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    exam_id: int,
    req: QuestionCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınava soru ekler."""
    result = await db.execute(
        select(Exam)
        .join(Course, Course.id == Exam.course_id)
        .where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    question = Question(
        exam_id=exam_id,
        question_type=req.question_type,
        body=req.body,
        points=req.points,
        sort_order=req.sort_order,
        explanation=req.explanation,
    )
    db.add(question)
    await db.flush()

    # Seçenekleri ekle
    for opt_data in req.options:
        option = Option(
            question_id=question.id,
            body=opt_data.body,
            is_correct=opt_data.is_correct,
            sort_order=opt_data.sort_order,
        )
        db.add(option)

    await db.flush()
    await db.refresh(question)

    # Options'ları yükle
    result = await db.execute(
        select(Question).where(Question.id == question.id).options(selectinload(Question.options))
    )
    return result.scalar_one()


@router.get("/{exam_id}/questions", response_model=List[QuestionResponse])
async def list_questions(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sınavdaki soruları listeler (eğitmen/gözetmen tam görünüm)."""
    result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .options(selectinload(Question.options))
        .order_by(Question.sort_order)
    )
    return result.scalars().unique().all()


@router.get("/{exam_id}/questions/student", response_model=List[QuestionResponseStudent])
async def list_questions_student(
    exam_id: int,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenci sınav görünümü - doğru cevaplar gizli."""
    result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .options(selectinload(Question.options))
        .order_by(Question.sort_order)
    )
    return result.scalars().unique().all()