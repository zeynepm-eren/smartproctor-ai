"""
SmartProctor - Kimlik Doğrulama Router
/register, /login, /refresh, /me endpoint'leri.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Kimlik Doğrulama"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Yeni kullanıcı kaydı oluşturur."""
    # Email kontrolü
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        role=UserRole(req.role),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Email ve şifre ile giriş yapar, JWT token döndürür."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Geçersiz email veya şifre")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap devre dışı")

    # Token'ları oluştur
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Refresh token'ı veritabanına kaydet
    rt = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)

    # Son giriş zamanını güncelle
    user.last_login_at = datetime.now(timezone.utc)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh token ile yeni access token alır."""
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Geçersiz refresh token")

    # Veritabanında token kontrolü
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == req.refresh_token,
            RefreshToken.revoked == False,
        )
    )
    stored_token = result.scalar_one_or_none()
    if not stored_token:
        raise HTTPException(status_code=401, detail="Token iptal edilmiş veya bulunamadı")

    # Eski token'ı iptal et
    stored_token.revoked = True

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")

    # Yeni token'lar oluştur
    new_access = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    rt = RefreshToken(
        user_id=user.id,
        token=new_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcı bilgilerini döndürür."""
    return current_user
