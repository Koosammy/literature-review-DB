from pydantic_settings import BaseSettings
from typing import List, Union, Optional
import json
import os

class Settings(BaseSettings):
    # Database - Same as public site
    DATABASE_URL: str
    
    # Admin Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Password Reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 15
    
    # Email Configuration (Gmail SMTP) - Make them Optional with defaults
    MAIL_ENABLED: bool = False  # Default to False, set via env
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[str] = None
    MAIL_FROM_NAME: str = "UHAS Research Hub Admin"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    MAIL_TIMEOUT: int = 60
    
    # File Upload - Database Storage
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB for database storage
    ALLOWED_FILE_TYPES: List[str] = [".pdf", ".doc", ".docx", ".txt", ".rtf"]
    
    # Storage Backend
    STORAGE_BACKEND: str = "database"  # Always database now
    
    # Admin Portal
    PROJECT_NAME: str = "Literature Review Database - Admin Portal"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Admin portal for managing literature review database"
    ADMIN_SITE_URL: str = "https://research-hub-admin-portal.onrender.com"
    
    # Frontend URL for password reset links
    FRONTEND_URL: str = "https://research-hub-admin-portal.onrender.com"

    # Backend URL (for API calls)
    BACKEND_URL: str = "https://literature-admin-backend.onrender.com"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        "https://research-hub-admin-portal.onrender.com",
        "https://literature-admin-backend.onrender.com"
    ]

    # Upload settings
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "allow"
    
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
        
        # Override with environment variables if they exist
        # This ensures environment variables take precedence
        if os.getenv("MAIL_ENABLED"):
            self.MAIL_ENABLED = os.getenv("MAIL_ENABLED", "false").lower() in ["true", "1", "yes", "on"]
        
        if os.getenv("MAIL_USERNAME"):
            self.MAIL_USERNAME = os.getenv("MAIL_USERNAME")
        
        if os.getenv("MAIL_PASSWORD"):
            self.MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
        
        if os.getenv("MAIL_FROM"):
            self.MAIL_FROM = os.getenv("MAIL_FROM")
        elif self.MAIL_USERNAME:  # Use MAIL_USERNAME as fallback for MAIL_FROM
            self.MAIL_FROM = self.MAIL_USERNAME

    @property
    def is_email_configured(self) -> bool:
        """Check if email is properly configured"""
        configured = bool(
            self.MAIL_ENABLED and
            self.MAIL_USERNAME and
            self.MAIL_PASSWORD and
            self.MAIL_SERVER and
            self.MAIL_FROM
        )
        # Log the configuration status for debugging
        if not configured:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Email configuration check: ENABLED={self.MAIL_ENABLED}, "
                       f"USERNAME={'set' if self.MAIL_USERNAME else 'missing'}, "
                       f"PASSWORD={'set' if self.MAIL_PASSWORD else 'missing'}, "
                       f"FROM={'set' if self.MAIL_FROM else 'missing'}")
        return configured

# Create settings instance
settings = Settings()

# Log email configuration status on startup
import logging
logger = logging.getLogger(__name__)
logger.info(f"Email service configured: {settings.is_email_configured}")
if settings.MAIL_ENABLED:
    logger.info(f"Email settings: SERVER={settings.MAIL_SERVER}, PORT={settings.MAIL_PORT}, "
               f"FROM={settings.MAIL_FROM if settings.MAIL_FROM else 'not set'}")
