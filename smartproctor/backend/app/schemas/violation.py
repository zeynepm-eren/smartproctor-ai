"""
SmartProctor - İhlal ve Doğrulama Şemaları
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ViolationCreate(BaseModel):
    session_id: int
    violation_type: str
    confidence: Optional[float] = Field(None, ge=0, le=1)
    metadata: Optional[dict] = None


class ViolationResponse(BaseModel):
    id: int
    session_id: int
    violation_type: str
    confidence: Optional[float]
    video_path: Optional[str]
    thumbnail_path: Optional[str]
    detected_at: datetime
    review_status: Optional[str] = None

    class Config:
        from_attributes = True


class ReviewSubmit(BaseModel):
    decision: str = Field(..., pattern="^(violation_confirmed|no_violation)$")
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    violation_id: int
    proctor_id: int
    decision: str
    comment: Optional[str]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ConflictResolveRequest(BaseModel):
    final_decision: str = Field(..., pattern="^(violation_confirmed|no_violation)$")
    comment: Optional[str] = None


class ConflictResponse(BaseModel):
    id: int
    violation_id: int
    instructor_id: int
    final_decision: str
    comment: Optional[str]
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    title: str
    body: Optional[str]
    is_read: bool
    link: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
