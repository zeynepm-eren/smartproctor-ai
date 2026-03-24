"""
SmartProctor - Ek Endpoint'ler
Admin: istatistikler, kullanıcı silme. Eğitmen: sınav sonuçları.
Gözetmen ata özelliği kaldırıldı (otomatik rastgele atanıyor).
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
