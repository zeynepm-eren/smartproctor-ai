"""
SmartProctor - Ek Endpoint'ler
Admin istatistikleri, kullanıcı listeleri, gözetmen atama.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.session import ExamSession
from app.models.proctor import ProctorAssignment
from app.models.course import Course
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


# --- Admin İstatistikleri ---
@router.get("/api/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Sistem istatistikleri (admin)."""
    total_users = await db.scalar(select(func.count(User.id)))
    total_students = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.student))
    total_instructors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.instructor))
    total_proctors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.proctor))
    total_admins = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.admin))
    total_courses = await db.scalar(select(func.count(Course.id)))
    total_exams = await db.scalar(select(func.count(Exam.id)))
    
    return AdminStatsResponse(
        total_users=total_users or 0,
        total_students=total_students or 0,
        total_instructors=total_instructors or 0,
        total_proctors=total_proctors or 0,
        total_admins=total_admins or 0,
        total_courses=total_courses or 0,
        total_exams=total_exams or 0,
    )


# --- Kullanıcı Listeleri ---
@router.get("/api/auth/users", response_model=List[UserListResponse])
async def list_users(
    role: Optional[str] = Query(None),
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcı listesi."""
    query = select(User)
    if current_user.role.value == "instructor":
        query = query.where(User.role == UserRole.student)
    elif role:
        query = query.where(User.role == UserRole(role))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/api/auth/instructors", response_model=List[UserListResponse])
async def list_instructors(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Eğitmen listesi (admin)."""
    result = await db.execute(
        select(User).where(User.role == UserRole.instructor, User.is_active == True)
    )
    return result.scalars().all()


@router.get("/api/auth/students", response_model=List[UserListResponse])
async def list_students(
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenci listesi."""
    result = await db.execute(
        select(User).where(User.role == UserRole.student, User.is_active == True)
    )
    return result.scalars().all()


@router.get("/api/auth/proctors", response_model=List[UserListResponse])
async def list_proctors(
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Gözetmen listesi."""
    result = await db.execute(
        select(User).where(User.role == UserRole.proctor, User.is_active == True)
    )
    return result.scalars().all()


# --- Gözetmen Atama ---
class ProctorAssignRequest(BaseModel):
    proctor_id: int


@router.post("/api/exams/{exam_id}/assign-proctor")
async def assign_proctor(
    exam_id: int,
    req: ProctorAssignRequest,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınava gözetmen atar."""
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    result = await db.execute(
        select(User).where(User.id == req.proctor_id, User.role == UserRole.proctor)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Gözetmen bulunamadı")

    result = await db.execute(
        select(ProctorAssignment).where(
            ProctorAssignment.exam_id == exam_id,
            ProctorAssignment.proctor_id == req.proctor_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu gözetmen zaten atanmış")

    assignment = ProctorAssignment(exam_id=exam_id, proctor_id=req.proctor_id)
    db.add(assignment)
    await db.flush()
    return {"message": "Gözetmen atandı"}


# --- Sınav Sonuçları ---
@router.get("/api/sessions/exam/{exam_id}/results", response_model=List[SessionResponse])
async def exam_results(
    exam_id: int,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınav sonuçları."""
    result = await db.execute(
        select(ExamSession).where(ExamSession.exam_id == exam_id)
    )
    return result.scalars().all()