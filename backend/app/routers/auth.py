"""
SmartProctor - Kimlik Doğrulama Router
Eğitmen/Gözetmen kaydı için gizli anahtar zorunlu.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os, uuid
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

# Eğitmen ve Gözetmen kayıt için gizli anahtarlar
INSTRUCTOR_SECRET_KEY = settings.INSTRUCTOR_SECRET_KEY
PROCTOR_SECRET_KEY = settings.PROCTOR_SECRET_KEY


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Yeni kullanıcı kaydı. Eğitmen/Gözetmen için gizli anahtar zorunlu."""
    # Email kontrolü
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    # Eğitmen ve Gözetmen için gizli anahtar kontrolü
    if req.role == "instructor":
        if not req.secret_key or req.secret_key != INSTRUCTOR_SECRET_KEY:
            raise HTTPException(
                status_code=403,
                detail="Eğitmen kaydı için geçerli bir gizli anahtar gereklidir"
            )
    elif req.role == "proctor":
        if not req.secret_key or req.secret_key != PROCTOR_SECRET_KEY:
            raise HTTPException(
                status_code=403,
                detail="Gözetmen kaydı için geçerli bir gizli anahtar gereklidir"
            )

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
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Geçersiz email veya şifre")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap devre dışı")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    rt = RefreshToken(
        user_id=user.id, token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    user.last_login_at = datetime.now(timezone.utc)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Geçersiz refresh token")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == req.refresh_token, RefreshToken.revoked == False,
        )
    )
    stored_token = result.scalar_one_or_none()
    if not stored_token:
        raise HTTPException(status_code=401, detail="Token iptal edilmiş veya bulunamadı")

    stored_token.revoked = True
    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")

    new_access = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    rt = RefreshToken(
        user_id=user.id, token=new_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    req: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ad, soyad, e-posta ve şifre güncelleme."""
    from pydantic import BaseModel
    first_name = req.get("first_name")
    last_name = req.get("last_name")
    email = req.get("email")
    new_password = req.get("new_password")
    current_password = req.get("current_password")

    if first_name:
        current_user.first_name = first_name.strip()
    if last_name:
        current_user.last_name = last_name.strip()
    if email and email != current_user.email:
        existing = await db.execute(select(User).where(User.email == email, User.id != current_user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bu e-posta zaten kullanımda")
        current_user.email = email.strip()
    if new_password:
        if not current_password:
            raise HTTPException(status_code=400, detail="Mevcut şifre gereklidir")
        from app.core.security import verify_password, hash_password
        if not verify_password(current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
        current_user.password_hash = hash_password(new_password)

    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/profile/photo", response_model=UserResponse)
async def upload_profile_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Profil fotoğrafı yükleme."""
    upload_dir = os.path.join(settings.UPLOAD_DIR, "profiles")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(photo.filename or "photo.jpg")[1] or ".jpg"
    filename = f"profile_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)

    content = await photo.read()
    with open(filepath, "wb") as f:
        f.write(content)

    if hasattr(current_user, 'profile_photo_url'):
        current_user.profile_photo_url = f"/evidence/profiles/{filename}"
    await db.flush()
    await db.refresh(current_user)
    return current_user

