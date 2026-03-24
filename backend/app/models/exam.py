"""
SmartProctor - Sınav, Soru ve Seçenek Modelleri
"""

import enum
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, Boolean, Integer, Numeric,
    DateTime, Enum, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ExamStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    true_false = "true_false"


class Exam(Base):
    __tablename__ = "exams"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.courses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus, name="exam_status", schema="smartproctor", create_type=False),
        default=ExamStatus.draft,
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    pass_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    course = relationship("Course", back_populates="exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")
    sessions = relationship("ExamSession", back_populates="exam", cascade="all, delete-orphan")
    proctor_assignments = relationship("ProctorAssignment", back_populates="exam", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.exams.id", ondelete="CASCADE"), nullable=False
    )
    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, name="question_type", schema="smartproctor", create_type=False),
        default=QuestionType.multiple_choice,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[float] = mapped_column(Numeric(5, 2), default=1.00)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    exam = relationship("Exam", back_populates="questions")
    options = relationship("Option", back_populates="question", cascade="all, delete-orphan")


class Option(Base):
    __tablename__ = "options"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.questions.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    question = relationship("Question", back_populates="options")
