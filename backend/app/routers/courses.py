"""
SmartProctor - Ders Yönetimi Router
Ders CRUD, eğitmen atama ve öğrenci kayıt işlemleri.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
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
    role = current_user.role.value
    
    if role == "admin":
        result = await db.execute(select(Course).options(selectinload(Course.instructor)))
    elif role == "instructor":
        result = await db.execute(
            select(Course).options(selectinload(Course.instructor))
            .where(Course.instructor_id == current_user.id)
        )
    elif role == "student":
        result = await db.execute(
            select(Course).options(selectinload(Course.instructor))
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .where(CourseEnrollment.student_id == current_user.id)
        )
    else:
        result = await db.execute(
            select(Course).options(selectinload(Course.instructor))
            .where(Course.is_active == True)
        )
    return result.scalars().all()


@router.get("/all", response_model=List[CourseResponse])
async def list_all_courses(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Tüm dersleri listeler (sadece admin)."""
    result = await db.execute(select(Course).options(selectinload(Course.instructor)))
    return result.scalars().all()


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    req: CourseCreate,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Yeni ders oluşturur (admin veya eğitmen)."""
    existing = await db.execute(select(Course).where(Course.code == req.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu ders kodu zaten kullanılıyor")
    
    if current_user.role.value == "admin":
        instructor_id = None
    else:
        instructor_id = current_user.id
    
    course = Course(
        instructor_id=instructor_id,
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
    result = await db.execute(
        select(Course).options(selectinload(Course.instructor)).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    req: CourseUpdate,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Ders bilgilerini günceller."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    
    if current_user.role.value == "instructor" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu dersi düzenleme yetkiniz yok")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    await db.flush()
    await db.refresh(course)
    return course


@router.post("/{course_id}/assign-instructor")
async def assign_instructor(
    course_id: int,
    req: dict,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Derse eğitmen atar (sadece admin)."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    
    instructor_id = req.get("instructor_id")
    result = await db.execute(
        select(User).where(User.id == instructor_id, User.role == UserRole.instructor)
    )
    instructor = result.scalar_one_or_none()
    if not instructor:
        raise HTTPException(status_code=404, detail="Eğitmen bulunamadı")
    
    course.instructor_id = instructor_id
    await db.flush()
    return {"message": "Eğitmen atandı", "course_id": course_id, "instructor_id": instructor_id}


@router.delete("/{course_id}/remove-instructor")
async def remove_instructor(
    course_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Dersten eğitmeni kaldırır (sadece admin)."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    
    course.instructor_id = None
    await db.flush()
    return {"message": "Eğitmen kaldırıldı"}


@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_student(
    course_id: int,
    req: EnrollmentCreate,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenciyi derse kaydeder."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    
    if current_user.role.value == "instructor" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu derse öğrenci kaydetme yetkiniz yok")
    
    existing = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_id == req.student_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Öğrenci zaten kayıtlı")
    
    enrollment = CourseEnrollment(course_id=course_id, student_id=req.student_id)
    db.add(enrollment)
    await db.flush()
    
    # Student ilişkisini yükle
    result = await db.execute(
        select(CourseEnrollment)
        .options(selectinload(CourseEnrollment.student))
        .where(CourseEnrollment.id == enrollment.id)
    )
    return result.scalar_one()


@router.delete("/{course_id}/unenroll/{student_id}")
async def unenroll_student(
    course_id: int,
    student_id: int,
    current_user: User = Depends(require_role("admin", "instructor")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenciyi dersten çıkarır."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    
    if current_user.role.value == "instructor" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_id == student_id
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    
    await db.delete(enrollment)
    await db.flush()
    return {"message": "Öğrenci çıkarıldı"}


@router.get("/{course_id}/students", response_model=List[EnrollmentResponse])
async def list_enrolled_students(
    course_id: int,
    current_user: User = Depends(require_role("admin", "instructor", "proctor")),
    db: AsyncSession = Depends(get_db),
):
    """Derse kayıtlı öğrenci listesini döndürür."""
    if current_user.role.value == "instructor":
        result = await db.execute(
            select(Course).where(Course.id == course_id, Course.instructor_id == current_user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    result = await db.execute(
        select(CourseEnrollment)
        .options(selectinload(CourseEnrollment.student))
        .where(CourseEnrollment.course_id == course_id)
    )
    return result.scalars().all()