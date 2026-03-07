"""
SmartProctor - Sınav Oturumu Router
Sınav başlatma, cevap kaydetme (debounce), sınav bitirme ve otomatik puanlama.
"""

from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.exam import Exam, Question, Option
from app.models.session import ExamSession, StudentAnswer, SessionStatus
from app.models.course import CourseEnrollment
from app.schemas.session import (
    SessionStartResponse, AnswerSubmit, AnswerResponse,
    SessionFinishResponse, SessionResponse,
)

router = APIRouter(prefix="/api/sessions", tags=["Sınav Oturumları"])


@router.post("/start/{exam_id}", response_model=SessionStartResponse)
async def start_exam_session(
    exam_id: int,
    request: Request,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrenci sınava başlar - oturum oluşturulur."""
    # Sınav kontrolü
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sınav bulunamadı")

    if exam.status.value not in ("active", "scheduled"):
        raise HTTPException(status_code=400, detail="Sınav aktif değil")

    # Kayıt kontrolü
    result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == exam.course_id,
            CourseEnrollment.student_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu derse kayıtlı değilsiniz")

    # Mevcut oturum kontrolü
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.exam_id == exam_id,
            ExamSession.student_id == current_user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.status.value in ("submitted", "timed_out", "terminated"):
            raise HTTPException(status_code=400, detail="Bu sınavı zaten tamamladınız")
        # Devam eden oturumu döndür
        return SessionStartResponse(
            session_id=existing.id,
            exam_id=existing.exam_id,
            started_at=existing.started_at,
            duration_minutes=exam.duration_minutes,
            status=existing.status.value,
        )

    # Yeni oturum oluştur
    session = ExamSession(
        exam_id=exam_id,
        student_id=current_user.id,
        status=SessionStatus.in_progress,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    return SessionStartResponse(
        session_id=session.id,
        exam_id=session.exam_id,
        started_at=session.started_at,
        duration_minutes=exam.duration_minutes,
        status=session.status.value,
    )


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(
    req: AnswerSubmit,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Cevap kaydeder (debounce mekanizması ile).
    Aynı soru için tekrar gönderilirse günceller.
    """
    # Aktif oturum bul
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.student_id == current_user.id,
            ExamSession.status == SessionStatus.in_progress,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="Aktif sınav oturumu bulunamadı")

    # Mevcut cevap kontrolü (upsert mantığı)
    result = await db.execute(
        select(StudentAnswer).where(
            StudentAnswer.session_id == session.id,
            StudentAnswer.question_id == req.question_id,
        )
    )
    existing_answer = result.scalar_one_or_none()

    if existing_answer:
        existing_answer.selected_option_id = req.selected_option_id
        existing_answer.answered_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(existing_answer)
        return existing_answer
    else:
        answer = StudentAnswer(
            session_id=session.id,
            question_id=req.question_id,
            selected_option_id=req.selected_option_id,
        )
        db.add(answer)
        await db.flush()
        await db.refresh(answer)
        return answer


@router.post("/finish/{session_id}", response_model=SessionFinishResponse)
async def finish_exam(
    session_id: int,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Sınavı bitirir ve otomatik puanlama yapar."""
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.student_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    if session.status.value in ("submitted", "timed_out"):
        raise HTTPException(status_code=400, detail="Sınav zaten tamamlanmış")

    # Otomatik puanlama
    result = await db.execute(
        select(StudentAnswer)
        .where(StudentAnswer.session_id == session.id)
    )
    answers = result.scalars().all()

    # Her cevap için doğruluğu kontrol et
    correct_count = 0
    total_points = 0
    earned_points = 0

    result = await db.execute(
        select(Question)
        .where(Question.exam_id == session.exam_id)
        .options(selectinload(Question.options))
    )
    questions = result.scalars().unique().all()
    question_map = {q.id: q for q in questions}

    for answer in answers:
        question = question_map.get(answer.question_id)
        if question:
            total_points += float(question.points)
            if answer.selected_option_id:
                # Doğru seçeneği bul
                correct_option = next(
                    (o for o in question.options if o.is_correct), None
                )
                if correct_option and answer.selected_option_id == correct_option.id:
                    answer.is_correct = True
                    correct_count += 1
                    earned_points += float(question.points)
                else:
                    answer.is_correct = False

    # Toplam puan hesapla
    total_possible = sum(float(q.points) for q in questions)
    score = (earned_points / total_possible * 100) if total_possible > 0 else 0

    session.status = SessionStatus.submitted
    session.finished_at = datetime.now(timezone.utc)
    session.score = round(score, 2)

    await db.flush()

    return SessionFinishResponse(
        session_id=session.id,
        status="submitted",
        score=session.score,
        finished_at=session.finished_at,
        total_questions=len(questions),
        correct_answers=correct_count,
    )


@router.post("/tab-switch/{session_id}")
async def log_tab_switch(
    session_id: int,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Sekme değişikliğini loglar ve sayacı artırır."""
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.student_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    session.tab_switch_count += 1

    # Sınav limiti kontrolü
    result = await db.execute(select(Exam).where(Exam.id == session.exam_id))
    exam = result.scalar_one_or_none()

    terminated = False
    if exam and session.tab_switch_count >= exam.max_tab_switches:
        session.status = SessionStatus.terminated
        session.finished_at = datetime.now(timezone.utc)
        terminated = True

    await db.flush()

    return {
        "tab_switch_count": session.tab_switch_count,
        "max_allowed": exam.max_tab_switches if exam else 3,
        "terminated": terminated,
    }


@router.get("/my-sessions", response_model=List[SessionResponse])
async def my_sessions(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Öğrencinin tüm sınav oturumlarını listeler."""
    result = await db.execute(
        select(ExamSession).where(ExamSession.student_id == current_user.id)
    )
    return result.scalars().all()
