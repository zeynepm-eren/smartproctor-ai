"""
SmartProctor - İhlal ve Doğrulama Modelleri
AI/tarayıcı ihlalleri, çift kör doğrulama ve uyuşmazlık çözümü.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, Numeric, DateTime, Enum, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ViolationType(str, enum.Enum):
    TAB_SWITCH = "TAB_SWITCH"
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    COPY_PASTE = "COPY_PASTE"
    RIGHT_CLICK = "RIGHT_CLICK"
    DEVTOOLS = "DEVTOOLS"
    GAZE_LEFT = "GAZE_LEFT"
    GAZE_RIGHT = "GAZE_RIGHT"
    PHONE_DETECTED = "PHONE_DETECTED"
    MULTIPLE_PERSONS = "MULTIPLE_PERSONS"
    OTHER = "OTHER"


class VerificationDecision(str, enum.Enum):
    violation_confirmed = "violation_confirmed"
    no_violation = "no_violation"
    pending = "pending"


class ConflictResolutionStatus(str, enum.Enum):
    pending = "pending"
    violation_confirmed = "violation_confirmed"
    no_violation = "no_violation"


class Violation(Base):
    __tablename__ = "violations"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.exam_sessions.id", ondelete="CASCADE"), nullable=False
    )
    violation_type: Mapped[ViolationType] = mapped_column(
        Enum(ViolationType, name="violation_type", schema="smartproctor", create_type=False),
        nullable=False,
    )
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    video_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ExamSession", back_populates="violations")
    reviews = relationship("ViolationReview", back_populates="violation", cascade="all, delete-orphan")
    conflict_resolution = relationship(
        "ConflictResolution", back_populates="violation", uselist=False, cascade="all, delete-orphan"
    )


class ViolationReview(Base):
    __tablename__ = "violation_reviews"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    violation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.violations.id", ondelete="CASCADE"), nullable=False
    )
    proctor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.users.id", ondelete="CASCADE"), nullable=False
    )
    decision: Mapped[VerificationDecision] = mapped_column(
        Enum(VerificationDecision, name="verification_decision", schema="smartproctor", create_type=False),
        default=VerificationDecision.pending,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    violation = relationship("Violation", back_populates="reviews")


class ConflictResolution(Base):
    __tablename__ = "conflict_resolutions"
    __table_args__ = {"schema": "smartproctor"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    violation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.violations.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    instructor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("smartproctor.users.id", ondelete="CASCADE"), nullable=False
    )
    final_decision: Mapped[ConflictResolutionStatus] = mapped_column(
        Enum(ConflictResolutionStatus, name="conflict_resolution", schema="smartproctor", create_type=False),
        default=ConflictResolutionStatus.pending,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    violation = relationship("Violation", back_populates="conflict_resolution")
