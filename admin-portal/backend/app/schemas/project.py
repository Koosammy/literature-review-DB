from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime

class ProjectImageBase(BaseModel):
    filename: str
    content_type: str = "image/png"
    order_index: int = 0
    is_featured: bool = False

class ProjectImageResponse(ProjectImageBase):
    id: int
    project_id: int
    image_size: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  # Make optional to handle missing column
    
    @property
    def image_url(self) -> str:
        # Return the correct URL without double /api/
        return f"/projects/{self.project_id}/images/{self.id}"
    
    model_config = ConfigDict(from_attributes=True)

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
    is_published: bool = True

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[str] = None
    research_area: Optional[str] = None
    degree_type: Optional[str] = None
    academic_year: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    supervisor: Optional[str] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: Optional[bool] = None

class ProjectResponse(ProjectBase):
    id: int
    slug: str
    is_published: bool
    publication_date: Optional[datetime] = None  # Make optional to handle NULL values
    view_count: int = 0  # Provide defaults
    download_count: int = 0
    
    # Legacy image fields with defaults
    images: List[str] = Field(default_factory=list)
    featured_image_index: int = 0
    
    # New image records with default
    image_records: List[ProjectImageResponse] = Field(default_factory=list)
    
    # Database Storage Fields - all optional
    document_filename: Optional[str] = None
    document_size: Optional[int] = None
    document_content_type: Optional[str] = None
    document_storage: Optional[str] = None
    
    # Metadata
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  # Make optional for safety
    
    model_config = ConfigDict(from_attributes=True)

    def model_post_init(self, __context) -> None:
        """Called after the model is initialized. Replaces __init__ override in Pydantic v2."""
        # Populate image URLs for backward compatibility
        if self.image_records:
            self.images = [f"/api/projects/{self.id}/images/{img.id}" for img in self.image_records]
            # Find featured image index
            for idx, img in enumerate(self.image_records):
                if img.is_featured:
                    self.featured_image_index = idx
                    break

class ImageUploadResponse(BaseModel):
    images: List[str]
    message: str

class SetFeaturedImageRequest(BaseModel):
    image_id: int

class ReorderImagesRequest(BaseModel):
    image_ids: List[int]

# Additional schemas for better error handling
class ProjectListResponse(BaseModel):
    """Response model for project list endpoints"""
    projects: List[ProjectResponse]
    total: int
    page: int = 1
    page_size: int = 100
    
    model_config = ConfigDict(from_attributes=True)

class ProjectStats(BaseModel):
    """Stats response model"""
    total_projects: int = 0
    published_projects: int = 0
    total_views: int = 0
    total_downloads: int = 0
    
    model_config = ConfigDict(from_attributes=True)
