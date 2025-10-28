from pydantic_settings import BaseSettings
from typing import List, Union, Optional
import json
import os
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # Database - Same as public site
    DATABASE_URL: str
    
    # Admin Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Password Reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 15
    
    # Email Configuration - Don't use Optional, use empty string defaults
    MAIL_ENABLED: bool = True
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
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
    STORAGE_BACKEND: str = "database"
    
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
        
        # Set MAIL_FROM to MAIL_USERNAME if not provided
        if not self.MAIL_FROM and self.MAIL_USERNAME:
            self.MAIL_FROM = self.MAIL_USERNAME
        
        # Debug: Print what we loaded
        logger.info(f"Email Config Loaded: MAIL_ENABLED={self.MAIL_ENABLED}")
        logger.info(f"MAIL_USERNAME={'***' + self.MAIL_USERNAME[-10:] if self.MAIL_USERNAME else 'NOT SET'}")
        logger.info(f"MAIL_PASSWORD={'SET' if self.MAIL_PASSWORD else 'NOT SET'}")
        logger.info(f"MAIL_FROM={self.MAIL_FROM if self.MAIL_FROM else 'NOT SET'}")
        logger.info(f"MAIL_SERVER={self.MAIL_SERVER}")
    
    @property
    def is_email_configured(self) -> bool:
        """Check if email is properly configured"""
        has_username = bool(self.MAIL_USERNAME)
        has_password = bool(self.MAIL_PASSWORD)
        has_from = bool(self.MAIL_FROM)
        has_server = bool(self.MAIL_SERVER)
        is_enabled = self.MAIL_ENABLED
        
        # Debug logging
        logger.info(f"Email Configuration Check:")
        logger.info(f"  - MAIL_ENABLED: {is_enabled}")
        logger.info(f"  - Has USERNAME: {has_username}")
        logger.info(f"  - Has PASSWORD: {has_password}")
        logger.info(f"  - Has FROM: {has_from}")
        logger.info(f"  - Has SERVER: {has_server}")
        
        configured = is_enabled and has_username and has_password and has_from and has_server
        logger.info(f"  → Email configured: {configured}")
        
        return configured

# Initialize settings
settings = Settings()
