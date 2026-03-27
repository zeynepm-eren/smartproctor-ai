"""
SmartProctor - User (Kullanıcı) Modeli
Öğrenci, Eğitmen ve Gözetmen rolleri tek tabloda tutulur.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    BigInteger, String, Boolean, Enum, DateTime, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    instructor = "instructor"
    proctor = "proctor"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", schema="smartproctor", create_type=False),
        nullable=False,
        default=UserRole.student,
    )
    profile_photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # İlişkiler
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    courses_taught = relationship("Course", back_populates="instructor")
    enrollments = relationship("CourseEnrollment", back_populates="student")
    exam_sessions = relationship("ExamSession", back_populates="student")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
