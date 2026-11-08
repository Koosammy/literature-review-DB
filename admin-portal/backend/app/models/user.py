from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text, LargeBinary
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
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    institution = Column(String(255))  # displayed as "School" in the UI
    department = Column(String(255))
    phone = Column(String(20))
    # Public URL for clients plus durable image bytes stored in PostgreSQL.
    # Render Free has an ephemeral filesystem, so profile photos must not
    # depend on files under uploads/.
    profile_image = Column(String, nullable=True)
    profile_image_data = Column(LargeBinary, nullable=True)
    profile_image_content_type = Column(String(100), nullable=True)
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
    def name_parts(self) -> tuple[str, str]:
        if self.first_name is not None or self.last_name is not None:
            return self.first_name or "", self.last_name or ""
        parts = (self.full_name or "").rsplit(maxsplit=1)
        return (parts[0], parts[1]) if len(parts) == 2 else ((parts[0] if parts else ""), "")

    @property
    def formal_name(self) -> str:
        title = (self.title or "").strip()
        if title:
            _, last_name = self.name_parts
            return f"{title} {last_name or self.full_name}"
        return self.full_name

    @property
    def name_details(self) -> dict:
        return {
            "full_name": self.full_name,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "title": self.title,
            "formal_name": self.formal_name,
        }

    def resolve_name_update(self, fields: dict) -> dict:
        """Keep the legacy display name in sync when either name field changes."""
        if "first_name" in fields or "last_name" in fields:
            first_name, last_name = self.name_parts
            first_name = (fields.get("first_name", first_name) or "").strip()
            last_name = (fields.get("last_name", last_name) or "").strip()
            full_name = " ".join(part for part in (first_name, last_name) if part)
            fields = {**fields, "first_name": first_name or None, "last_name": last_name or None}
        elif "full_name" in fields:
            full_name = (fields["full_name"] or "").strip()
            if full_name != self.full_name:
                fields = {**fields, "first_name": None, "last_name": None}
        else:
            return fields

        if not full_name or len(full_name) > 255:
            raise ValueError("Enter a name between 1 and 255 characters.")
        return {**fields, "full_name": full_name}

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
