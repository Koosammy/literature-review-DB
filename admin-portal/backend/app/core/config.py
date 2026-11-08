from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings
from typing import List, Union
import json

class Settings(BaseSettings):
    # Database - Same as public site
    DATABASE_URL: str

    @field_validator("DATABASE_URL")
    @classmethod
    def select_postgres_driver(cls, value: str) -> str:
        scheme, separator, address = value.partition("://")
        # Keep using the installed psycopg2 driver with SQLAlchemy 2.1 and newer.
        if separator and scheme in {"postgres", "postgresql"}:
            return f"postgresql+psycopg2://{address}"
        return value
    
    # Admin Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Password Reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 15
    
    # Transactional email through Brevo's HTTPS API.
    BREVO_API_KEY: SecretStr = SecretStr("")
    MAIL_FROM: str = ""
    MAIL_FROM_NAME: str = "UHAS Research Hub Admin"

    # File Upload - Database Storage
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB for database storage
    ALLOWED_FILE_TYPES: List[str] = [".pdf", ".doc", ".docx", ".txt", ".rtf"]
    
    # Storage Backend
    STORAGE_BACKEND: str = "database"
    
    # Admin Portal
    PROJECT_NAME: str = "Literature Review Database - Admin Portal"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Admin portal for managing literature review database"
    ADMIN_SITE_URL: str = "https://research-hub-admin-portal-xn6w.onrender.com"
    
    # Frontend URL for password reset links
    FRONTEND_URL: str = "https://research-hub-admin-portal-xn6w.onrender.com"
    
    # Backend URL (for API calls)
    BACKEND_URL: str = "https://literature-admin-backend.onrender.com"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        "https://research-hub-admin-portal-xn6w.onrender.com",
        "https://literature-admin-backend.onrender.com"
    ]
    
    # Runtime uploads are validated in memory and persisted to PostgreSQL.
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Older local .env files may still include retired email settings.
        extra = "ignore"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Parse CORS_ORIGINS if it's a string
        if isinstance(self.CORS_ORIGINS, str):
            try:
                self.CORS_ORIGINS = json.loads(self.CORS_ORIGINS)
            except json.JSONDecodeError:
                if "," in self.CORS_ORIGINS:
                    self.CORS_ORIGINS = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
                else:
                    self.CORS_ORIGINS = [self.CORS_ORIGINS.strip()]


settings = Settings()
