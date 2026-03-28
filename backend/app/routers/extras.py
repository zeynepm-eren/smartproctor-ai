"""
SmartProctor - Ek Endpoint'ler
Admin: istatistikler, kullanıcı silme. Eğitmen: sınav sonuçları.
Gözetmen ata özelliği kaldırıldı (otomatik rastgele atanıyor).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.session import ExamSession
from app.models.course import Course
from app.models.proctor import ProctorAssignment
from app.models.violation import ViolationReview, VerificationDecision, Violation
from app.schemas.session import SessionResponse
from pydantic import BaseModel

router = APIRouter(tags=["Ek İşlemler"])


class UserListResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_users: int
    total_students: int
    total_instructors: int
    total_proctors: int
    total_admins: int
    total_courses: int
    total_exams: int


@router.get("/api/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    total_users = await db.scalar(select(func.count(User.id)))
    total_students = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.student))
    total_instructors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.instructor))
    total_proctors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.proctor))
    total_admins = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.admin))
    total_courses = await db.scalar(select(func.count(Course.id)))
    total_exams = await db.scalar(select(func.count(Exam.id)))
    return AdminStatsResponse(
        total_users=total_users or 0, total_students=total_students or 0,
        total_instructors=total_instructors or 0, total_proctors=total_proctors or 0,
        total_admins=total_admins or 0, total_courses=total_courses or 0, total_exams=total_exams or 0,
    )


@router.get("/api/auth/users", response_model=List[UserListResponse])
async def list_users(
    role: Optional[str] = Query(None),
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if current_user.role.value == "instructor":
        query = query.where(User.role == UserRole.student)
    elif role:
        query = query.where(User.role == UserRole(role))
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/api/auth/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcıyı siler (sadece admin). Admin kendini silemez."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    await db.delete(user)
    await db.flush()
    return {"message": f"Kullanıcı {user.email} silindi"}


@router.get("/api/auth/instructors", response_model=List[UserListResponse])
async def list_instructors(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == UserRole.instructor, User.is_active == True)
    )
    return result.scalars().all()


@router.get("/api/auth/students", response_model=List[UserListResponse])
async def list_students(
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == UserRole.student, User.is_active == True)
    )
    return result.scalars().all()


@router.get("/api/auth/proctors", response_model=List[UserListResponse])
async def list_proctors(
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == UserRole.proctor, User.is_active == True)
    )
    return result.scalars().all()


@router.get("/api/admin/proctor-assignments")
async def admin_proctor_assignments(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Hangi sınava hangi gözetmenler atanmış listesi."""
    result = await db.execute(
        select(ProctorAssignment, Exam, User, Course)
        .join(Exam, Exam.id == ProctorAssignment.exam_id)
        .join(User, User.id == ProctorAssignment.proctor_id)
        .join(Course, Course.id == Exam.course_id)
        .order_by(Exam.id)
    )
    rows = result.all()
    assignments = []
    for pa, exam, proctor, course in rows:
        assignments.append({
            "exam_id": exam.id,
            "exam_title": exam.title,
            "course_name": course.name,
            "course_code": course.code,
            "proctor_id": proctor.id,
            "proctor_name": f"{proctor.first_name} {proctor.last_name}",
            "proctor_email": proctor.email,
            "assigned_at": pa.assigned_at.isoformat() if pa.assigned_at else None,
        })
    return assignments


class ProctorAssignRequest(BaseModel):
    exam_id: int
    proctor_id: int


class ProctorSwapRequest(BaseModel):
    exam_id: int
    old_proctor_id: int
    new_proctor_id: int


@router.post("/api/admin/proctor-assignments")
async def admin_add_proctor(
    req: ProctorAssignRequest,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Sınava gözetmen ekler."""
    # Sınav kontrolü
    exam = await db.execute(select(Exam).where(Exam.id == req.exam_id))
    if not exam.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    # Gözetmen kontrolü
    proctor = await db.execute(
        select(User).where(User.id == req.proctor_id, User.role == UserRole.proctor, User.is_active == True)
    )
    if not proctor.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Gözetmen bulunamadı")

    # Zaten atanmış mı?
    existing = await db.execute(
        select(ProctorAssignment).where(
            ProctorAssignment.exam_id == req.exam_id,
            ProctorAssignment.proctor_id == req.proctor_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu gözetmen zaten bu sınava atanmış")

    assignment = ProctorAssignment(exam_id=req.exam_id, proctor_id=req.proctor_id)
    db.add(assignment)
    await db.flush()
    return {"message": "Gözetmen başarıyla atandı"}


@router.delete("/api/admin/proctor-assignments/{exam_id}/{proctor_id}")
async def admin_remove_proctor(
    exam_id: int,
    proctor_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Sınavdan gözetmen çıkarır."""
    result = await db.execute(
        select(ProctorAssignment).where(
            ProctorAssignment.exam_id == exam_id,
            ProctorAssignment.proctor_id == proctor_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")

    await db.delete(assignment)
    await db.flush()
    return {"message": "Gözetmen ataması kaldırıldı"}


@router.post("/api/admin/proctor-assignments/swap")
async def admin_swap_proctor(
    req: ProctorSwapRequest,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Gözetmeni değiştirir ve bekleyen ihlal incelemelerini yeni gözetmene aktarır."""
    if req.old_proctor_id == req.new_proctor_id:
        raise HTTPException(status_code=400, detail="Eski ve yeni gözetmen aynı olamaz")

    # Sınav kontrolü
    exam_result = await db.execute(select(Exam).where(Exam.id == req.exam_id))
    if not exam_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    # Eski gözetmen atanmış mı?
    old_assignment = await db.execute(
        select(ProctorAssignment).where(
            ProctorAssignment.exam_id == req.exam_id,
            ProctorAssignment.proctor_id == req.old_proctor_id,
        )
    )
    old_assign = old_assignment.scalar_one_or_none()
    if not old_assign:
        raise HTTPException(status_code=404, detail="Eski gözetmen bu sınava atanmamış")

    # Yeni gözetmen geçerli mi?
    new_proctor = await db.execute(
        select(User).where(User.id == req.new_proctor_id, User.role == UserRole.proctor, User.is_active == True)
    )
    if not new_proctor.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Yeni gözetmen bulunamadı")

    # Yeni gözetmen zaten atanmış mı?
    existing = await db.execute(
        select(ProctorAssignment).where(
            ProctorAssignment.exam_id == req.exam_id,
            ProctorAssignment.proctor_id == req.new_proctor_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Yeni gözetmen zaten bu sınava atanmış")

    # Bu sınavın tüm oturumlarını bul
    sessions_result = await db.execute(
        select(ExamSession.id).where(ExamSession.exam_id == req.exam_id)
    )
    session_ids = [row[0] for row in sessions_result.fetchall()]

    transferred_count = 0
    if session_ids:
        # Bu oturumlardaki ihlalleri bul
        violations_result = await db.execute(
            select(Violation.id).where(Violation.session_id.in_(session_ids))
        )
        violation_ids = [row[0] for row in violations_result.fetchall()]

        if violation_ids:
            # Eski gözetmenin bekleyen (pending) incelemelerini yeni gözetmene aktar
            update_result = await db.execute(
                sql_update(ViolationReview)
                .where(
                    ViolationReview.violation_id.in_(violation_ids),
                    ViolationReview.proctor_id == req.old_proctor_id,
                    ViolationReview.decision == VerificationDecision.pending,
                )
                .values(proctor_id=req.new_proctor_id)
            )
            transferred_count = update_result.rowcount

    # Gözetmen atamasını değiştir: eski çıkar, yeni ekle
    await db.delete(old_assign)
    new_assignment = ProctorAssignment(exam_id=req.exam_id, proctor_id=req.new_proctor_id)
    db.add(new_assignment)
    await db.flush()

    return {
        "message": f"Gözetmen değiştirildi. {transferred_count} bekleyen inceleme yeni gözetmene aktarıldı.",
        "transferred_reviews": transferred_count,
    }


@router.get("/api/sessions/exam/{exam_id}/results", response_model=List[SessionResponse])
async def exam_results(
    exam_id: int,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExamSession).where(ExamSession.exam_id == exam_id)
    )
    return result.scalars().all()
