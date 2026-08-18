from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://username:password@localhost/literature_db"
    
    # App Settings
    PROJECT_NAME: str = "Literature Review Database"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Discover and explore academic research projects and literature reviews"
    
    # SEO
    SITE_URL: str = "https://uhas-research-hub.onrender.com"

    # Admin-portal backend, for building absolute URLs to assets it serves
    # (currently: supervisor profile photos, uploaded under /api/uploads).
    ADMIN_BACKEND_URL: str = "https://literature-admin-backend.onrender.com"
    
    # Storage Backend
    STORAGE_BACKEND: str = "database"  # Changed from supabase
    
    # File Upload (Legacy - kept for backward compatibility)
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

settings = Settings()
