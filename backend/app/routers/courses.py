"""
SmartProctor - Ders Yönetimi Router
Ders CRUD ve öğrenci kayıt işlemleri.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse,
    EnrollmentCreate, EnrollmentResponse,
)

router = APIRouter(prefix="/api/courses", tags=["Dersler"])


@router.get("/", response_model=List[CourseResponse])
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcının rolüne göre ders listesini döndürür."""
    if current_user.role.value == "instructor":
        # Eğitmen kendi derslerini görür
        result = await db.execute(
            select(Course).where(Course.instructor_id == current_user.id)
        )
    elif current_user.role.value == "student":
        # Öğrenci kayıtlı olduğu dersleri görür
        result = await db.execute(
            select(Course)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(CourseEnrollment.student_id == current_user.id)
        )
    else:
        # Gözetmen tüm aktif dersleri görür
        result = await db.execute(select(Course).where(Course.is_active == True))

    return result.scalars().all()


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    req: CourseCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Yeni ders oluşturur (sadece eğitmen)."""
    course = Course(
        instructor_id=current_user.id,
        code=req.code,
        name=req.name,
        description=req.description,
    )
    db.add(course)
    await db.flush()
    await db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ders detayını döndürür."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    req: CourseUpdate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Ders bilgilerini günceller (sadece eğitmen)."""
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.instructor_id == current_user.id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    await db.flush()
    await db.refresh(course)
    return course


# --- Öğrenci Kayıt ---
@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_student(
    course_id: int,
    req: EnrollmentCreate,
    current_user: User = Depends(require_role("instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenciyi derse kaydeder (eğitmen yapar)."""
    enrollment = CourseEnrollment(course_id=course_id, student_id=req.student_id)
    db.add(enrollment)
    await db.flush()
    await db.refresh(enrollment)
    return enrollment


@router.get("/{course_id}/students", response_model=List[EnrollmentResponse])
async def list_enrolled_students(
    course_id: int,
    current_user: User = Depends(require_role("instructor", "proctor")),
    db: AsyncSession = Depends(get_db),
):
    """Derse kayıtlı öğrenci listesini döndürür."""
    result = await db.execute(
        select(CourseEnrollment).where(CourseEnrollment.course_id == course_id)
    )
    return result.scalars().all()
