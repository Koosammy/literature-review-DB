from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from ..core.config import settings


def _to_absolute_image_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{settings.ADMIN_BACKEND_URL}/api/uploads/profile_images/{path}"


class SupervisorBrief(BaseModel):
    """Supervisor info embedded in a project's response."""
    id: int
    title: Optional[str] = None
    full_name: str
    institution: Optional[str] = None
    profile_image: Optional[str] = None

    @field_validator("profile_image")
    @classmethod
    def _absolute_image(cls, v):
        return _to_absolute_image_url(v)

    class Config:
        from_attributes = True

class ProjectImageResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    content_type: str
    order_index: int
    is_featured: bool
    image_size: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    title: str
    abstract: Optional[str] = None
    keywords: Optional[str] = None
    research_area: Optional[str] = None
    degree_type: Optional[str] = None
    academic_year: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    supervisor: Optional[str] = None
    author_name: str
    author_email: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    slug: str
    is_published: bool
    publication_date: datetime
    view_count: int
    download_count: int
    
    # Legacy image fields
    images: Optional[List[str]] = []
    featured_image_index: Optional[int] = 0
    
    # New image records
    image_records: List[ProjectImageResponse] = []

    # Linked supervisor accounts (empty for legacy projects that only have
    # the free-text `supervisor` field above).
    supervisors: List[SupervisorBrief] = []

    # Database Storage Fields
    document_filename: Optional[str] = None
    document_size: Optional[int] = None
    document_content_type: Optional[str] = None
    document_storage: Optional[str] = None
    
    # Metadata
    created_by_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
        orm_mode = True

class SupervisorWork(BaseModel):
    """One entry in a supervisor's list of supervised, published works."""
    id: int
    title: str
    slug: str
    degree_type: Optional[str] = None
    academic_year: Optional[str] = None
    publication_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class SupervisorProfile(BaseModel):
    """Full public profile for the supervisor click-through modal."""
    id: int
    title: Optional[str] = None
    full_name: str
    institution: Optional[str] = None
    about: Optional[str] = None
    profile_image: Optional[str] = None
    works_count: int
    works: List[SupervisorWork] = []

    @field_validator("profile_image")
    @classmethod
    def _absolute_image(cls, v):
        return _to_absolute_image_url(v)

    class Config:
        from_attributes = True

class ProjectStats(BaseModel):
    """Schema for project statistics"""
    total_projects: int
    total_institutions: int
    total_research_areas: int
    total_downloads: int
    total_views: int = 0

class ProjectFileInfo(BaseModel):
    """Schema for file information responses"""
    filename: Optional[str] = None
    size: Optional[int] = None
    content_type: Optional[str] = None
    storage: Optional[str] = None
    download_count: int = 0
    view_count: int = 0
    available: bool = False
