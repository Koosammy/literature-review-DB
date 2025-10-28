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
    
    # Email Configuration (Gmail SMTP)
    MAIL_ENABLED: bool = True  # Add this to control email sending
    MAIL_USERNAME: str = ""  # Make optional with default
    MAIL_PASSWORD: str = ""  # App-specific password - make optional with default
    MAIL_FROM: str = ""  # Make optional with default
    MAIL_FROM_NAME: str = "UHAS Research Hub Admin"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    MAIL_TIMEOUT: int = 60  # Add timeout setting for SMTP connections
    MAIL_DEBUG: bool = False  # Add debug flag for email issues
    
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
        # Allow extra fields from environment
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
        
        # Handle email configuration from environment variables
        # This ensures proper parsing of boolean values from environment
        env_mail_enabled = os.getenv("MAIL_ENABLED", "").lower()
        if env_mail_enabled in ["true", "1", "yes", "on"]:
            self.MAIL_ENABLED = True
        elif env_mail_enabled in ["false", "0", "no", "off"]:
            self.MAIL_ENABLED = False
        
        # Set default email values if not provided
        if not self.MAIL_USERNAME:
            self.MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
        if not self.MAIL_PASSWORD:
            self.MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
        if not self.MAIL_FROM:
            self.MAIL_FROM = os.getenv("MAIL_FROM", self.MAIL_USERNAME)
        
        # Parse MAIL_TIMEOUT from environment
        mail_timeout = os.getenv("MAIL_TIMEOUT", "60")
        try:
            self.MAIL_TIMEOUT = int(mail_timeout)
        except ValueError:
            self.MAIL_TIMEOUT = 60
        
        # Parse boolean settings from environment
        for bool_field in ["MAIL_STARTTLS", "MAIL_SSL_TLS", "USE_CREDENTIALS", "VALIDATE_CERTS", "MAIL_DEBUG"]:
            env_value = os.getenv(bool_field, "").lower()
            if env_value in ["true", "1", "yes", "on"]:
                setattr(self, bool_field, True)
            elif env_value in ["false", "0", "no", "off"]:
                setattr(self, bool_field, False)

    @property
    def is_email_configured(self) -> bool:
        """Check if email is properly configured"""
        return bool(
            self.MAIL_ENABLED and
            self.MAIL_USERNAME and
            self.MAIL_PASSWORD and
            self.MAIL_SERVER and
            self.MAIL_FROM
        )
    
    def get_email_config_status(self) -> dict:
        """Get email configuration status for debugging"""
        return {
            "enabled": self.MAIL_ENABLED,
            "configured": self.is_email_configured,
            "server": self.MAIL_SERVER if self.is_email_configured else "Not configured",
            "port": self.MAIL_PORT,
            "username": self.MAIL_USERNAME[:3] + "***" if self.MAIL_USERNAME else "Not set",
            "from_email": self.MAIL_FROM if self.MAIL_FROM else "Not set",
            "timeout": self.MAIL_TIMEOUT,
            "debug": self.MAIL_DEBUG
        }

# Create settings instance
try:
    settings = Settings()
    # Log email configuration status on startup
    if settings.MAIL_DEBUG:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Email configuration status: {settings.get_email_config_status()}")
except Exception as e:
    # Fallback settings if environment variables are missing
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Failed to load settings: {e}")
    # You might want to raise this in production
    raise
