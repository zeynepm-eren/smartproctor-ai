"""
SmartProctor - Audit Log Middleware
Her API isteğini audit_logs tablosuna kaydeder.
"""

from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy import text
from app.core.database import async_session_factory
from app.core.security import decode_token


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Her API isteğini loglayan middleware."""

    # Loglanmayacak endpoint'ler (performans için)
    SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next):
        # Statik ve health endpoint'lerini atla
        if request.url.path in self.SKIP_PATHS or request.url.path.startswith("/evidence"):
            return await call_next(request)

        # Kullanıcı ID'sini token'dan çöz
        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            if payload:
                user_id = payload.get("sub")

        # İsteği işle
        response = await call_next(request)

        # Sadece mutasyon işlemlerini logla (POST, PUT, DELETE)
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            try:
                # Entity bilgisini URL'den çıkar
                path_parts = request.url.path.strip("/").split("/")
                entity_type = path_parts[1] if len(path_parts) > 1 else None
                entity_id = None
                if len(path_parts) > 2 and path_parts[2].isdigit():
                    entity_id = int(path_parts[2])

                async with async_session_factory() as session:
                    await session.execute(
                        text("""
                            INSERT INTO smartproctor.audit_logs
                            (user_id, action, entity_type, entity_id, ip_address, details)
                            VALUES (:user_id, :action, :entity_type, :entity_id, :ip,
                                    :details::jsonb)
                        """),
                        {
                            "user_id": int(user_id) if user_id else None,
                            "action": f"{request.method} {request.url.path}",
                            "entity_type": entity_type,
                            "entity_id": entity_id,
                            "ip": request.client.host if request.client else None,
                            "details": f'{{"status": {response.status_code}}}',
                        },
                    )
                    await session.commit()
            except Exception:
                pass  # Audit log hatası ana işlemi engellemez

        return response
