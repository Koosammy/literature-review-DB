from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from .base import BaseModel

class User(BaseModel):
    __tablename__ = "users"

    # Authentication
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    title = Column(String(20), nullable=True)  # e.g. Dr., Prof., Mr., Mrs.
    full_name = Column(String(255), nullable=False)
    institution = Column(String(255))  # displayed as "School" in the UI
    department = Column(String(255))
    phone = Column(String(20))
    profile_image = Column(String, nullable=True)
    about = Column(Text, nullable=True)
    disciplines = Column(Text, nullable=True)
    role = Column(String(50), default="faculty")
    is_active = Column(Boolean, default=True)
    # True for accounts created via admin invite / bulk import that haven't
    # set their own password yet. Existing accounts default False so this
    # never retroactively locks anyone out.
    must_set_password = Column(Boolean, default=False, nullable=False)
    reset_token = Column(String, index=True)
    reset_token_expires = Column(DateTime, nullable=True)
    # Relationships
    created_projects = relationship("Project", back_populates="created_by_user")
    supervised_projects = relationship(
        "Project",
        secondary="project_supervisors",
        back_populates="supervisors",
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}', role='{self.role}')>"
    
    @property
    def is_main_coordinator(self):
        """Check if user is a main coordinator"""
        return self.role == "main_coordinator"
    
    @property
    def is_faculty(self):
        """Check if user is faculty"""
        return self.role == "faculty"
    
    def has_reset_token_expired(self):
        """Check if the reset token has expired"""
        if not self.reset_token_expires:
            return True
        from datetime import datetime
        return self.reset_token_expires < datetime.utcnow()
    
    def clear_reset_token(self):
        """Clear the reset token and expiration"""
        self.reset_token = None
        self.reset_token_expires = None
