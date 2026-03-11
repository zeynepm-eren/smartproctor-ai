"""
SmartProctor - Ders Şemaları
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class InstructorInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    
    class Config:
        from_attributes = True


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    instructor_id: Optional[int] = None
    instructor: Optional[InstructorInfo] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    student_id: int


class StudentInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    
    class Config:
        from_attributes = True


class EnrollmentResponse(BaseModel):
    id: int
    course_id: int
    student_id: int
    student: Optional[StudentInfo] = None
    enrolled_at: datetime
    
    class Config:
        from_attributes = True