"""
SmartProctor - Sınav Oturumu ve Cevap Şemaları
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionStartResponse(BaseModel):
    session_id: int
    exam_id: int
    started_at: datetime
    duration_minutes: int
    status: str

    class Config:
        from_attributes = True


class AnswerSubmit(BaseModel):
    question_id: int
    selected_option_id: int


class AnswerResponse(BaseModel):
    id: int
    session_id: int
    question_id: int
    selected_option_id: Optional[int]
    answered_at: datetime

    class Config:
        from_attributes = True


class SessionFinishResponse(BaseModel):
    session_id: int
    status: str
    score: Optional[float]
    finished_at: datetime
    total_questions: int
    correct_answers: int


class SessionResponse(BaseModel):
    id: int
    exam_id: int
    student_id: int
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    tab_switch_count: int
    score: Optional[float]

    class Config:
        from_attributes = True
