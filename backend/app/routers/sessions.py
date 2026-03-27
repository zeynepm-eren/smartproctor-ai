"""
SmartProctor - Sinav Oturumu Router
"""

from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.exam import Exam, Question, Option, ExamStatus
from app.models.session import ExamSession, StudentAnswer, SessionStatus
from app.models.course import CourseEnrollment
from app.schemas.session import (
    SessionStartResponse, AnswerSubmit, AnswerResponse,
    SessionFinishResponse, SessionResponse,
)

router = APIRouter(prefix="/api/sessions", tags=["Sinav Oturumlari"])


@router.post("/start/{exam_id}", response_model=SessionStartResponse)
async def start_exam_session(
    exam_id: int,
    request: Request,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Sinav bulunamadi")

    if exam.status not in (ExamStatus.active, ExamStatus.scheduled):
        raise HTTPException(status_code=400, detail="Sinav aktif degil")

    result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.course_id == exam.course_id,
            CourseEnrollment.student_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu derse kayitli degilsiniz")

    result = await db.execute(
        select(ExamSession).where(
            ExamSession.exam_id == exam_id,
            ExamSession.student_id == current_user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.status.value in ("submitted", "timed_out", "terminated"):
            raise HTTPException(status_code=400, detail="Bu sinavi zaten tamamladiniz")
        return SessionStartResponse(
            session_id=existing.id,
            exam_id=existing.exam_id,
            started_at=existing.started_at,
            duration_minutes=exam.duration_minutes,
            status=existing.status.value,
        )

    now = datetime.now(timezone.utc)
    session = ExamSession(
        exam_id=exam_id,
        student_id=current_user.id,
        status=SessionStatus.in_progress,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        last_heartbeat=now,
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
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.student_id == current_user.id,
            ExamSession.status == SessionStatus.in_progress,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="Aktif sinav oturumu bulunamadi")

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
    try:
        result = await db.execute(
            select(ExamSession).where(
                ExamSession.id == session_id,
                ExamSession.student_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadi")

        if session.status.value in ("submitted", "timed_out", "terminated"):
            return SessionFinishResponse(
                session_id=session.id,
                status=session.status.value,
                score=float(session.score) if session.score is not None else 0.0,
                finished_at=session.finished_at or datetime.now(timezone.utc),
                total_questions=0,
                correct_answers=0,
            )

        result2 = await db.execute(
            select(StudentAnswer.id, StudentAnswer.question_id, StudentAnswer.selected_option_id)
            .where(StudentAnswer.session_id == session.id)
        )
        answers_raw = result2.all()

        correct_count = 0
        earned_points = 0.0

        result3 = await db.execute(
            select(Question)
            .where(Question.exam_id == session.exam_id)
            .options(selectinload(Question.options))
        )
        questions = result3.scalars().unique().all()
        question_map = {q.id: q for q in questions}

        answer_ids_to_mark = []
        for row in answers_raw:
            ans_id, q_id, sel_opt_id = row
            question = question_map.get(q_id)
            if question and sel_opt_id:
                correct_option = next((o for o in question.options if o.is_correct), None)
                if correct_option and sel_opt_id == correct_option.id:
                    answer_ids_to_mark.append((ans_id, True))
                    correct_count += 1
                    earned_points += float(question.points)
                else:
                    answer_ids_to_mark.append((ans_id, False))

        for ans_id, is_correct in answer_ids_to_mark:
            await db.execute(
                StudentAnswer.__table__.update()
                .where(StudentAnswer.__table__.c.id == ans_id)
                .values(is_correct=is_correct)
            )

        total_possible = sum(float(q.points) for q in questions)
        score = round((earned_points / total_possible * 100) if total_possible > 0 else 0.0, 2)

        session.status = SessionStatus.submitted
        session.finished_at = datetime.now(timezone.utc)
        session.score = score

        await db.flush()

        return SessionFinishResponse(
            session_id=session.id,
            status="submitted",
            score=score,
            finished_at=session.finished_at,
            total_questions=len(questions),
            correct_answers=correct_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Sinav bitirme hatasi: {str(e)} | {tb[-300:]}")


@router.post("/tab-switch/{session_id}")
async def log_tab_switch(
    session_id: int,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.student_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadi")

    session.tab_switch_count += 1
    await db.flush()

    return {
        "tab_switch_count": session.tab_switch_count,
        "terminated": False,
    }


@router.get("/my-sessions")
async def my_sessions(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExamSession, Exam.title)
        .join(Exam, Exam.id == ExamSession.exam_id)
        .where(ExamSession.student_id == current_user.id)
        .order_by(ExamSession.started_at.desc())
    )
    rows = result.all()
    sessions = []
    for session, exam_title in rows:
        sessions.append(SessionResponse(
            id=session.id,
            exam_id=session.exam_id,
            exam_title=exam_title,
            student_id=session.student_id,
            status=session.status.value,
            started_at=session.started_at,
            finished_at=session.finished_at,
            tab_switch_count=session.tab_switch_count,
            score=session.score,
        ))
    return sessions