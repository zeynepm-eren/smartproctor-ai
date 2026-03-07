"""
SmartProctor - Uygulama Yapılandırması
Ortam değişkenlerini okur ve uygulama genelinde kullanılabilir hale getirir.
"""

from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Veritabanı
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smartproctor"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/smartproctor"

    # JWT
    SECRET_KEY: str = "super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'

    # Uygulama
    APP_NAME: str = "SmartProctor"
    DEBUG: bool = True

    # Dosya yükleme
    UPLOAD_DIR: str = "./static/evidence"
    MAX_UPLOAD_SIZE: int = 52428800  # 50MB

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
