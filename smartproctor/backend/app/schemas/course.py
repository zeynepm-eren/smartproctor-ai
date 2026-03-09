"""
SmartProctor - Ders Şemaları
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CourseCreate(BaseModel):
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CourseResponse(BaseModel):
    id: int
    instructor_id: int
    code: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    student_id: int


class EnrollmentResponse(BaseModel):
    id: int
    course_id: int
    student_id: int
    enrolled_at: datetime

    class Config:
        from_attributes = True
