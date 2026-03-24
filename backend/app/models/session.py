"""
SmartProctor - Sınav Oturumu ve Öğrenci Cevapları Modelleri
"""

import enum
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, Boolean, Integer, Numeric,
    DateTime, Enum, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class SessionStatus(str, enum.Enum):
    started = "started"
    in_progress = "in_progress"
    submitted = "submitted"
    timed_out = "timed_out"
    terminated = "terminated"


class ExamSession(Base):
    __tablename__ = "exam_sessions"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.exams.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", schema="smartproctor", create_type=False),
        default=SessionStatus.started,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    tab_switch_count: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    exam = relationship("Exam", back_populates="sessions")
    student = relationship("User", back_populates="exam_sessions")
    answers = relationship("StudentAnswer", back_populates="session", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="session", cascade="all, delete-orphan")


class StudentAnswer(Base):
    __tablename__ = "student_answers"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.exam_sessions.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.questions.id", ondelete="CASCADE"), nullable=False
    )
    selected_option_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("smartproctor.options.id", ondelete="SET NULL"), nullable=True
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ExamSession", back_populates="answers")
    question = relationship("Question")
    selected_option = relationship("Option")
