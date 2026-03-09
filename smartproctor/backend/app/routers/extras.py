"""
SmartProctor - Ek Endpoint'ler
Gözetmen atama, sınav sonuçları, kullanıcı listesi.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.session import ExamSession
from app.models.proctor import ProctorAssignment
from app.models.course import Course
from app.schemas.auth import UserResponse
from app.schemas.session import SessionResponse
from pydantic import BaseModel

router = APIRouter(tags=["Ek İşlemler"])


# --- Kullanıcı Listesi (Rol bazlı filtreleme) ---
class UserListResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    class Config:
        from_attributes = True


@router.get("/api/auth/users", response_model=List[UserListResponse])
async def list_users(
    role: Optional[str] = Query(None),
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcı listesi (eğitmen için). Rol ile filtrelenebilir."""
    query = select(User)
    if role:
        query = query.where(User.role == UserRole(role))
    result = await db.execute(query)
    return result.scalars().all()


# --- Gözetmen Atama ---
class ProctorAssignRequest(BaseModel):
    proctor_id: int


@router.post("/api/exams/{exam_id}/assign-proctor")
async def assign_proctor(
    exam_id: int,
    req: ProctorAssignRequest,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Sınava gözetmen atar (eğitmen)."""
    # Sınav sahiplik kontrolü
    result = await db.execute(
        select(Exam)
        .join(Course, Course.id == Exam.course_id)
        .where(Exam.id == exam_id, Course.instructor_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınav size ait değil")

    # Gözetmen kontrolü
    result = await db.execute(
        select(User).where(User.id == req.proctor_id, User.role == UserRole.proctor)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Gözetmen bulunamadı")

    # Mevcut atama kontrolü
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

    return {"message": "Gözetmen başarıyla atandı", "exam_id": exam_id, "proctor_id": req.proctor_id}


# --- Sınav Sonuçları (Eğitmen için) ---
@router.get("/api/sessions/exam/{exam_id}/results", response_model=List[SessionResponse])
async def exam_results(
    exam_id: int,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Bir sınavdaki tüm öğrenci oturumlarını listeler (eğitmen)."""
    result = await db.execute(
        select(ExamSession).where(ExamSession.exam_id == exam_id)
    )
    return result.scalars().all()
