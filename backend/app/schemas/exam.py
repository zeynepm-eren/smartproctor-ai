"""
SmartProctor - Sınav, Soru ve Seçenek Şemaları
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OptionCreate(BaseModel):
    body: str
    is_correct: bool = False
    sort_order: int = 0


class OptionResponse(BaseModel):
    id: int
    body: str
    is_correct: bool
    sort_order: int
    class Config:
        from_attributes = True


class OptionResponseStudent(BaseModel):
    id: int
    body: str
    sort_order: int
    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    question_type: str = "multiple_choice"
    body: str
    image_url: Optional[str] = None
    points: float = 1.0
    sort_order: int = 0
    explanation: Optional[str] = None
    options: List[OptionCreate] = []


class QuestionUpdate(BaseModel):
    question_type: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    points: Optional[float] = None
    sort_order: Optional[int] = None
    explanation: Optional[str] = None
    options: Optional[List[OptionCreate]] = None


class QuestionResponse(BaseModel):
    id: int
    exam_id: int
    question_type: str
    body: str
    image_url: Optional[str] = None
    points: float
    sort_order: int
    explanation: Optional[str]
    options: List[OptionResponse] = []
    class Config:
        from_attributes = True


class QuestionResponseStudent(BaseModel):
    id: int
    question_type: str
    body: str
    image_url: Optional[str] = None
    points: float
    sort_order: int
    options: List[OptionResponseStudent] = []
    class Config:
        from_attributes = True


class ExamCreate(BaseModel):
    course_id: int
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    duration_minutes: int = Field(..., gt=0)
    pass_score: Optional[float] = None
    shuffle_questions: bool = False
    shuffle_options: bool = False
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str]
    status: str
    duration_minutes: int
    pass_score: Optional[float]
    shuffle_questions: bool
    shuffle_options: bool
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    created_at: datetime
    question_count: Optional[int] = None
    class Config:
        from_attributes = True
