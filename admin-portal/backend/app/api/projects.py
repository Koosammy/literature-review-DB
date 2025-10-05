from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
import io
from datetime import datetime
import csv
import logging

from ..database import get_db
from ..models.user import User
from ..models.project import Project, ProjectImage
from ..schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectImageResponse,
    ImageUploadResponse, SetFeaturedImageRequest, ReorderImagesRequest
)
from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.constants import RESEARCH_AREAS, DEGREE_TYPES, ACADEMIC_YEARS, INSTITUTIONS
from ..services.database_storage import database_storage
from ..services.database_image_service import DatabaseImageService
from ..services.document_image_extractor import DocumentImageExtractor

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize services
db_image_service = DatabaseImageService()
document_extractor = DocumentImageExtractor(db_image_service)

def create_slug(title: str) -> str:
    """Create a URL-friendly slug from title"""
    import re
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

# Background task for image extraction
async def extract_images_background(
    document_data: bytes,
    document_filename: str,
    project_id: int,
    extract_tables: bool = True
):
    """Extract images in the background after project creation"""
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        print(f"🔄 Starting background image extraction for project {project_id}")
        extracted_count = await document_extractor.extract_images_from_document(
            document_data,
            document_filename,
            project_id,
            db,
            extract_tables=extract_tables
        )
        print(f"✅ Background extraction completed: {extracted_count} images for project {project_id}")
    except Exception as e:
        print(f"❌ Background image extraction failed for project {project_id}: {e}")
        logger.error(f"Background image extraction failed for project {project_id}: {e}")
    finally:
        db.close()

def serialize_project(project: Project, include_images: bool = True) -> dict:
    """Safely serialize a project to dict avoiding lazy loading issues"""
    try:
        result = {
            "id": project.id,
            "title": project.title,
            "slug": project.slug,
            "abstract": project.abstract,
            "keywords": project.keywords,
            "research_area": project.research_area,
            "degree_type": project.degree_type,
            "academic_year": project.academic_year,
            "institution": project.institution,
            "department": project.department,
            "supervisor": project.supervisor,
            "author_name": project.author_name,
            "author_email": project.author_email,
            "is_published": project.is_published,
            "publication_date": project.publication_date.isoformat() if project.publication_date else None,
            "meta_description": project.meta_description,
            "meta_keywords": project.meta_keywords,
            "document_filename": project.document_filename,
            "document_size": project.document_size,
            "document_content_type": project.document_content_type,
            "document_storage": project.document_storage,
            "view_count": project.view_count or 0,
            "download_count": project.download_count or 0,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None,
            "created_by_id": project.created_by_id,
            "created_by": None,
            "image_records": [],
            "images": [],  # Legacy field for backward compatibility
            "featured_image_index": 0,  # Legacy field
            "featured_image": None,
            "document_url": f"/api/projects/{project.id}/download" if project.document_filename else None
        }
        
        # Add creator info if available
        if hasattr(project, 'created_by_user') and project.created_by_user:
            result["created_by"] = {
                "id": project.created_by_user.id,
                "username": project.created_by_user.username,
                "email": project.created_by_user.email,
                "full_name": project.created_by_user.full_name
            }
        
        # Add images if requested and available
        if include_images and hasattr(project, 'image_records'):
            try:
                images = []
                legacy_images = []  # For backward compatibility
                
                for idx, img in enumerate(project.image_records):
                    # Properly format image data to match ProjectImageResponse schema
                    image_data = {
                        "id": img.id,
                        "project_id": project.id,  # Add required project_id
                        "filename": img.filename,
                        "content_type": img.content_type or "image/png",  # Add required content_type
                        "image_size": img.image_size,  # Correct field name (not 'size')
                        "order_index": img.order_index,
                        "is_featured": img.is_featured,
                        "created_at": img.created_at.isoformat() if img.created_at else datetime.utcnow().isoformat(),  # Add required created_at
                        "updated_at": img.updated_at.isoformat() if hasattr(img, 'updated_at') and img.updated_at else None
                    }
                    images.append(image_data)
                    
                    # Add to legacy images list
                    image_url = f"/api/projects/{project.id}/images/{img.id}"
                    legacy_images.append(image_url)
                    
                    # Set featured image
                    if img.is_featured:
                        result["featured_image"] = image_url
                        result["featured_image_index"] = idx
                
                result["image_records"] = images
                result["images"] = legacy_images  # Legacy field for backward compatibility
                
                # If no featured image set, use first image
                if not result["featured_image"] and images:
                    result["featured_image"] = f"/api/projects/{project.id}/images/{images[0]['id']}"
                    result["featured_image_index"] = 0
                    
            except Exception as e:
                logger.warning(f"Could not serialize images for project {project.id}: {str(e)}")
                result["image_records"] = []
                result["images"] = []
        else:
            # Ensure empty lists even when no images
            result["image_records"] = []
            result["images"] = []
        
        return result
        
    except Exception as e:
        logger.error(f"Error serializing project {project.id if hasattr(project, 'id') else 'unknown'}: {str(e)}")
        raise

@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    research_area: Optional[str] = None,
    degree_type: Optional[str] = None,
    is_published: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all projects with filters"""
    try:
        # Use eager loading to avoid N+1 queries
        query = db.query(Project).options(
            joinedload(Project.created_by_user),
            joinedload(Project.image_records)
        )
        
        # Apply filters
        if search:
            query = query.filter(
                or_(
                    Project.title.ilike(f"%{search}%"),
                    Project.abstract.ilike(f"%{search}%"),
                    Project.author_name.ilike(f"%{search}%"),
                    Project.keywords.ilike(f"%{search}%")
                )
            )
        
        if research_area:
            query = query.filter(Project.research_area == research_area)
        
        if degree_type:
            query = query.filter(Project.degree_type == degree_type)
        
        if is_published is not None:
            query = query.filter(Project.is_published == is_published)
        
        # If user is not main coordinator, only show their projects
        if current_user.role != "main_coordinator":
            query = query.filter(Project.created_by_id == current_user.id)
        
        projects = query.offset(skip).limit(limit).all()
        
        # Serialize projects safely
        result = []
        for project in projects:
            try:
                serialized = serialize_project(project, include_images=True)
                result.append(serialized)
            except Exception as e:
                logger.error(f"Error serializing project {project.id}: {str(e)}")
                continue
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching projects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch projects: {str(e)}")

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a single project by ID"""
    try:
        # Use eager loading
        project = db.query(Project).options(
            joinedload(Project.created_by_user),
            joinedload(Project.image_records)
        ).filter(Project.id == project_id).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        return serialize_project(project, include_images=True)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch project: {str(e)}")

@router.post("/", response_model=ProjectResponse)
async def create_project(
    title: str = Form(...),
    abstract: Optional[str] = Form(None),
    keywords: Optional[str] = Form(None),
    research_area: Optional[str] = Form(None),
    custom_research_area: Optional[str] = Form(None),
    degree_type: Optional[str] = Form(None),
    custom_degree_type: Optional[str] = Form(None),
    academic_year: Optional[str] = Form(None),
    institution: Optional[str] = Form(None),
    custom_institution: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    supervisor: Optional[str] = Form(None),
    author_name: str = Form(...),
    author_email: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    meta_keywords: Optional[str] = Form(None),
    is_published: bool = Form(True),
    file: Optional[UploadFile] = File(None),
    extract_tables: bool = Form(True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new project"""
    try:
        # Handle custom fields
        final_research_area = custom_research_area if research_area == "Others" else research_area
        final_degree_type = custom_degree_type if degree_type == "Others" else degree_type
        final_institution = custom_institution if institution == "Others" else institution
        
        # Validate custom fields
        if research_area == "Others" and not custom_research_area:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom research area is required when 'Others' is selected"
            )
        
        if degree_type == "Others" and not custom_degree_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom degree type is required when 'Others' is selected"
            )
        
        if institution == "Others" and not custom_institution:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom institution is required when 'Others' is selected"
            )
        
        # Generate unique slug
        base_slug = create_slug(title)
        slug = base_slug
        counter = 1
        while db.query(Project).filter(Project.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        # Handle file upload
        document_filename = None
        document_size = None
        document_data = None
        document_content_type = None
        document_storage = "database"
        
        if file and file.filename:
            try:
                # Process file for database storage
                file_result = await database_storage.upload_file(file)
                
                document_filename = file_result["filename"]
                document_size = file_result["size"]
                document_data = file_result["data"]
                document_content_type = file_result["content_type"]
                document_storage = file_result["storage"]
                
                print(f"✅ File processed for database storage: {document_filename}")
                
            except Exception as e:
                logger.error(f"Failed to process uploaded file: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to process uploaded file: {str(e)}"
                )
        
        # Create project
        db_project = Project(
            title=title,
            slug=slug,
            abstract=abstract,
            keywords=keywords,
            research_area=final_research_area,
            degree_type=final_degree_type,
            academic_year=academic_year,
            institution=final_institution or current_user.institution,
            department=department or current_user.department,
            supervisor=supervisor,
            author_name=author_name,
            author_email=author_email,
            meta_description=meta_description,
            meta_keywords=meta_keywords,
            is_published=is_published,
            publication_date=datetime.utcnow() if is_published else None,
            document_filename=document_filename,
            document_size=document_size,
            document_data=document_data,
            document_content_type=document_content_type,
            document_storage=document_storage,
            created_by_id=current_user.id,
            view_count=0,
            download_count=0
        )
        
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        
        print(f"✅ Project created successfully: {db_project.slug}")
        
        # Schedule image extraction as background task if document was uploaded
        if file and file.filename and document_data:
            background_tasks.add_task(
                extract_images_background,
                document_data,
                document_filename,
                db_project.id,
                extract_tables
            )
            print(f"📋 Scheduled background image extraction for project {db_project.id}")
        
        # Load relationships for response
        db_project = db.query(Project).options(
            joinedload(Project.created_by_user),
            joinedload(Project.image_records)
        ).filter(Project.id == db_project.id).first()
        
        return serialize_project(db_project, include_images=True)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    title: Optional[str] = Form(None),
    abstract: Optional[str] = Form(None),
    keywords: Optional[str] = Form(None),
    research_area: Optional[str] = Form(None),
    custom_research_area: Optional[str] = Form(None),
    degree_type: Optional[str] = Form(None),
    custom_degree_type: Optional[str] = Form(None),
    academic_year: Optional[str] = Form(None),
    institution: Optional[str] = Form(None),
    custom_institution: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    supervisor: Optional[str] = Form(None),
    author_name: Optional[str] = Form(None),
    author_email: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    meta_keywords: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    file: Optional[UploadFile] = File(None),
    remove_file: Optional[bool] = Form(False),
    extract_images: Optional[bool] = Form(False),
    extract_tables: Optional[bool] = Form(True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an existing project"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Handle custom fields
        if research_area is not None:
            final_research_area = custom_research_area if research_area == "Others" else research_area
            if research_area == "Others" and not custom_research_area:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom research area is required when 'Others' is selected"
                )
            project.research_area = final_research_area
        
        if degree_type is not None:
            final_degree_type = custom_degree_type if degree_type == "Others" else degree_type
            if degree_type == "Others" and not custom_degree_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom degree type is required when 'Others' is selected"
                )
            project.degree_type = final_degree_type
        
        if institution is not None:
            final_institution = custom_institution if institution == "Others" else institution
            if institution == "Others" and not custom_institution:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom institution is required when 'Others' is selected"
                )
            project.institution = final_institution
        
        # Update other fields
        if title is not None:
            project.title = title
            # Update slug if title changed
            base_slug = create_slug(title)
            slug = base_slug
            counter = 1
            while db.query(Project).filter(and_(Project.slug == slug, Project.id != project_id)).first():
                slug = f"{base_slug}-{counter}"
                counter += 1
            project.slug = slug
        
        if abstract is not None:
            project.abstract = abstract
        if keywords is not None:
            project.keywords = keywords
        if academic_year is not None:
            project.academic_year = academic_year
        if department is not None:
            project.department = department
        if supervisor is not None:
            project.supervisor = supervisor
        if author_name is not None:
            project.author_name = author_name
        if author_email is not None:
            project.author_email = author_email
        if meta_description is not None:
            project.meta_description = meta_description
        if meta_keywords is not None:
            project.meta_keywords = meta_keywords
        if is_published is not None:
            project.is_published = is_published
            if is_published and not project.publication_date:
                project.publication_date = datetime.utcnow()
        
        # Handle file removal
        if remove_file:
            project.document_filename = None
            project.document_size = None
            project.document_data = None
            project.document_content_type = None
            project.document_storage = "database"
            print(f"🗑️  File removed from project: {project.title}")
        
        # Handle new file upload
        if file and file.filename:
            try:
                # Process new file for database storage
                file_result = await database_storage.upload_file(file)
                
                project.document_filename = file_result["filename"]
                project.document_size = file_result["size"]
                project.document_data = file_result["data"]
                project.document_content_type = file_result["content_type"]
                project.document_storage = file_result["storage"]
                
                print(f"✅ File updated for project: {project.title}")
                
                # Extract images if requested
                if extract_images:
                    background_tasks.add_task(
                        extract_images_background,
                        file_result["data"],
                        file_result["filename"],
                        project.id,
                        extract_tables
                    )
                    print(f"📋 Scheduled background image extraction for updated document")
                    
            except Exception as e:
                logger.error(f"Failed to process uploaded file: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to process uploaded file: {str(e)}"
                )
        
        db.commit()
        
        # Load relationships for response
        project = db.query(Project).options(
            joinedload(Project.created_by_user),
            joinedload(Project.image_records)
        ).filter(Project.id == project_id).first()
        
        return serialize_project(project, include_images=True)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project: {str(e)}"
        )

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a project"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Note: Images will be cascade deleted due to foreign key constraint
        db.delete(project)
        db.commit()
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )

# Document management endpoints
@router.get("/{project_id}/download")
async def download_project_file(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download project document"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        if not project.document_data:
            raise HTTPException(status_code=404, detail="No file available for download")
        
        # Increment download counter
        project.download_count = (project.download_count or 0) + 1
        db.commit()
        
        return StreamingResponse(
            io.BytesIO(project.document_data),
            media_type=project.document_content_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=\"{project.document_filename}\""
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download file")

@router.get("/{project_id}/view")
async def view_project_file(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """View project document in browser"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        if not project.document_data:
            raise HTTPException(status_code=404, detail="No file available for viewing")
        
        # Increment view counter
        project.view_count = (project.view_count or 0) + 1
        db.commit()
        
        return StreamingResponse(
            io.BytesIO(project.document_data),
            media_type=project.document_content_type or "application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=\"{project.document_filename}\""
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error viewing file for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to view file")

@router.put("/{project_id}/document")
async def update_project_document(
    project_id: int,
    file: UploadFile = File(...),
    extract_images: bool = Form(False),
    extract_tables: bool = Form(True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update only the document of a project"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Process new file
        file_result = await database_storage.upload_file(file)
        
        project.document_filename = file_result["filename"]
        project.document_size = file_result["size"]
        project.document_data = file_result["data"]
        project.document_content_type = file_result["content_type"]
        project.document_storage = file_result["storage"]
        
        if extract_images:
            # Extract images in background
            background_tasks.add_task(
                extract_images_background,
                file_result["data"],
                file_result["filename"],
                project.id,
                extract_tables
            )
        
        db.commit()
        db.refresh(project)
        
        return {
            "message": "Document updated successfully",
            "extract_images_scheduled": extract_images,
            "extract_tables": extract_tables
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update document for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update document: {str(e)}"
        )

@router.delete("/{project_id}/file")
async def delete_project_file(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete project document"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        if not project.document_data:
            raise HTTPException(status_code=404, detail="No file to delete")
        
        # Clear file fields
        project.document_filename = None
        project.document_size = None
        project.document_data = None
        project.document_content_type = None
        project.document_storage = "database"
        
        db.commit()
        return {"message": "File deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete file for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file"
        )

# Image management endpoints
@router.get("/{project_id}/images/{image_id}")
async def get_project_image(
    project_id: int,
    image_id: int,
    db: Session = Depends(get_db)
):
    """Serve image from database (public endpoint - no auth required)"""
    try:
        image = db.query(ProjectImage).filter(
            ProjectImage.id == image_id,
            ProjectImage.project_id == project_id
        ).first()
        
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        return Response(
            content=image.image_data,
            media_type=image.content_type or "image/jpeg",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": f'inline; filename="{image.filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving image {image_id} for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to serve image")

@router.post("/{project_id}/images", response_model=ImageUploadResponse)
async def upload_project_images(
    project_id: int,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload images to a project"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Check image limit
        current_image_count = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).count()
        if current_image_count + len(files) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 images allowed")
        
        # Upload each file to database
        new_images = []
        for idx, file in enumerate(files):
            db_image = await db_image_service.save_image_to_db(
                file=file,
                project_id=project_id,
                db=db,
                order_index=current_image_count + idx,
                is_featured=(current_image_count == 0 and idx == 0)
            )
            new_images.append(f"/api/projects/{project_id}/images/{db_image.id}")
        
        return ImageUploadResponse(
            images=new_images,
            message="Images uploaded successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload images for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload images")

@router.delete("/{project_id}/images/{image_id}")
async def delete_project_image(
    project_id: int,
    image_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a project image"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Get image
        image = db.query(ProjectImage).filter(
            ProjectImage.id == image_id,
            ProjectImage.project_id == project_id
        ).first()
        
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Delete image
        db.delete(image)
        
        # Reorder remaining images
        remaining_images = db.query(ProjectImage).filter(
            ProjectImage.project_id == project_id,
            ProjectImage.order_index > image.order_index
        ).all()
        
        for img in remaining_images:
            img.order_index -= 1
        
        db.commit()
        return {"message": "Image deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete image {image_id} for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete image")

@router.put("/{project_id}/featured-image")
async def set_featured_image(
    project_id: int,
    request: SetFeaturedImageRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Set featured image for a project"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Remove featured status from all images
        db.query(ProjectImage).filter(ProjectImage.project_id == project_id).update({"is_featured": False})
        
        # Set new featured image
        image = db.query(ProjectImage).filter(
            ProjectImage.id == request.image_id,
            ProjectImage.project_id == project_id
        ).first()
        
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        image.is_featured = True
        db.commit()
        
        return {"message": "Featured image updated"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to set featured image for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to set featured image")

@router.put("/{project_id}/images/reorder")
async def reorder_images(
    project_id: int,
    request: ReorderImagesRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reorder project images"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        # Verify all image IDs belong to this project
        images = db.query(ProjectImage).filter(
            ProjectImage.id.in_(request.image_ids),
            ProjectImage.project_id == project_id
        ).all()
        
        if len(images) != len(request.image_ids):
            raise HTTPException(status_code=400, detail="Invalid image IDs")
        
        # Update order
        for idx, image_id in enumerate(request.image_ids):
            db.query(ProjectImage).filter(ProjectImage.id == image_id).update({"order_index": idx})
        
        db.commit()
        return {"message": "Images reordered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to reorder images for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reorder images")

@router.post("/{project_id}/extract-images")
async def extract_images_from_project_document(
    project_id: int,
    extract_tables: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manually extract images and tables from an already uploaded document"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        if not project.document_data:
            raise HTTPException(status_code=400, detail="No document uploaded")
        
        # Extract images and tables
        extracted_count = await document_extractor.extract_images_from_document(
            project.document_data,
            project.document_filename,
            project_id,
            db,
            extract_tables=extract_tables
        )
        
        # Get breakdown of extracted items
        all_images = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).all()
        table_count = sum(1 for img in all_images if img.filename.startswith('table_'))
        figure_count = sum(1 for img in all_images if img.filename.startswith('figure_'))
        
        return {
            "message": f"Extracted {extracted_count} items",
            "total_images": len(all_images),
            "figures": figure_count,
            "tables": table_count,
            "extract_tables": extract_tables
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to extract images for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to extract images")

# Project status endpoints
@router.patch("/{project_id}/toggle-publish")
async def toggle_project_publish_status(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Toggle project publish status"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        project.is_published = not project.is_published
        if project.is_published and not project.publication_date:
            project.publication_date = datetime.utcnow()
        
        db.commit()
        db.refresh(project)
        status_text = "published" if project.is_published else "unpublished"
        return {
            "message": f"Project {status_text} successfully",
            "project": {
                "id": project.id,
                "title": project.title,
                "is_published": project.is_published
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to toggle publish status for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project status"
        )

# Statistics endpoints
@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get project statistics"""
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check permissions
        if current_user.role != "main_coordinator" and project.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        image_count = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).count()
        
        return {
            "view_count": project.view_count or 0,
            "download_count": project.download_count or 0,
            "image_count": image_count,
            "document_size": project.document_size or 0,
            "has_document": bool(project.document_data),
            "is_published": project.is_published
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get stats for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get project statistics")

@router.get("/stats/summary")
async def get_projects_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summary statistics for all projects"""
    try:
        query = db.query(Project)
        
        # Filter by user if not main coordinator
        if current_user.role != "main_coordinator":
            query = query.filter(Project.created_by_id == current_user.id)
        
        total_projects = query.count()
        published_projects = query.filter(Project.is_published == True).count()
        unpublished_projects = query.filter(Project.is_published == False).count()
        
        # Get projects with documents
        projects_with_docs = query.filter(Project.document_data != None).count()
        
        # Get total views and downloads
        stats = query.with_entities(
            func.sum(Project.view_count).label('total_views'),
            func.sum(Project.download_count).label('total_downloads')
        ).first()
        
        # Get total images count
        image_query = db.query(func.count(ProjectImage.id))
        if current_user.role != "main_coordinator":
            image_query = image_query.join(Project).filter(Project.created_by_id == current_user.id)
        total_images = image_query.scalar() or 0
        
        return {
            "total_projects": total_projects,
            "published_projects": published_projects,
            "unpublished_projects": unpublished_projects,
            "projects_with_documents": projects_with_docs,
            "total_views": stats.total_views or 0,
            "total_downloads": stats.total_downloads or 0,
            "total_images": total_images
        }
    except Exception as e:
        logger.error(f"Failed to get projects summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get projects summary")

# Batch operations
@router.post("/batch/publish")
async def batch_publish_projects(
    project_ids: List[int],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Publish multiple projects at once"""
    try:
        if current_user.role != "main_coordinator":
            raise HTTPException(
                status_code=403,
                detail="Only main coordinators can perform batch operations"
            )
        
        # Update projects and set publication_date if not set
        projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
        updated = 0
        for project in projects:
            project.is_published = True
            if not project.publication_date:
                project.publication_date = datetime.utcnow()
            updated += 1
        
        db.commit()
        
        return {
            "message": f"Published {updated} projects",
            "updated_count": updated
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to batch publish projects: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to batch publish projects")

@router.post("/batch/unpublish")
async def batch_unpublish_projects(
    project_ids: List[int],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unpublish multiple projects at once"""
    try:
        if current_user.role != "main_coordinator":
            raise HTTPException(
                status_code=403,
                detail="Only main coordinators can perform batch operations"
            )
        
        updated = db.query(Project).filter(
            Project.id.in_(project_ids)
        ).update(
            {"is_published": False},
            synchronize_session=False
        )
        
        db.commit()
        
        return {
            "message": f"Unpublished {updated} projects",
            "updated_count": updated
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to batch unpublish projects: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to batch unpublish projects")

@router.post("/batch/delete")
async def batch_delete_projects(
    project_ids: List[int],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete multiple projects at once"""
    try:
        if current_user.role != "main_coordinator":
            raise HTTPException(
                status_code=403,
                detail="Only main coordinators can perform batch operations"
            )
        
        # Get projects to delete
        projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
        deleted_count = len(projects)
        
        # Delete projects (images will cascade delete)
        for project in projects:
            db.delete(project)
        
        db.commit()
        
        return {
            "message": f"Deleted {deleted_count} projects",
            "deleted_count": deleted_count
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to batch delete projects: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to batch delete projects")

# Search and filter endpoints
@router.get("/search/advanced")
async def advanced_search(
    title: Optional[str] = None,
    author: Optional[str] = None,
    supervisor: Optional[str] = None,
    institution: Optional[str] = None,
    department: Optional[str] = None,
    research_area: Optional[str] = None,
    degree_type: Optional[str] = None,
    academic_year: Optional[str] = None,
    keywords: Optional[str] = None,
    has_document: Optional[bool] = None,
    has_images: Optional[bool] = None,
    is_published: Optional[bool] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Advanced search with multiple filters"""
    try:
        query = db.query(Project).options(
            joinedload(Project.created_by_user),
            joinedload(Project.image_records)
        )
        
        # Apply user filter if not main coordinator
        if current_user.role != "main_coordinator":
            query = query.filter(Project.created_by_id == current_user.id)
        
        # Apply filters
        if title:
            query = query.filter(Project.title.ilike(f"%{title}%"))
        if author:
            query = query.filter(Project.author_name.ilike(f"%{author}%"))
        if supervisor:
            query = query.filter(Project.supervisor.ilike(f"%{supervisor}%"))
        if institution:
            query = query.filter(Project.institution == institution)
        if department:
            query = query.filter(Project.department.ilike(f"%{department}%"))
        if research_area:
            query = query.filter(Project.research_area == research_area)
        if degree_type:
            query = query.filter(Project.degree_type == degree_type)
        if academic_year:
            query = query.filter(Project.academic_year == academic_year)
        if keywords:
            query = query.filter(Project.keywords.ilike(f"%{keywords}%"))
        if has_document is not None:
            if has_document:
                query = query.filter(Project.document_data != None)
            else:
                query = query.filter(Project.document_data == None)
        if is_published is not None:
            query = query.filter(Project.is_published == is_published)
        if created_after:
            query = query.filter(Project.created_at >= created_after)
        if created_before:
            query = query.filter(Project.created_at <= created_before)
        
        # Handle has_images filter
        if has_images is not None:
            if has_images:
                query = query.join(ProjectImage).distinct()
            else:
                query = query.outerjoin(ProjectImage).filter(ProjectImage.id == None)
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination
        projects = query.offset(skip).limit(limit).all()
        
        # Serialize projects
        result = []
        for project in projects:
            try:
                result.append(serialize_project(project, include_images=True))
            except Exception as e:
                logger.error(f"Error serializing project {project.id}: {str(e)}")
                continue
        
        return {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "projects": result
        }
    except Exception as e:
        logger.error(f"Failed to perform advanced search: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to perform search")

# Export endpoint
@router.get("/export/csv")
async def export_projects_csv(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export projects to CSV"""
    try:
        query = db.query(Project)
        
        # Filter by user if not main coordinator
        if current_user.role != "main_coordinator":
            query = query.filter(Project.created_by_id == current_user.id)
        
        projects = query.all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "ID", "Title", "Author", "Email", "Institution", "Department",
            "Research Area", "Degree Type", "Academic Year", "Supervisor",
            "Published", "Created At", "View Count", "Download Count",
            "Has Document", "Image Count"
        ])
        
        # Write data
        for project in projects:
            image_count = db.query(ProjectImage).filter(
                ProjectImage.project_id == project.id
            ).count()
            
            writer.writerow([
                project.id,
                project.title,
                project.author_name,
                project.author_email or "",
                project.institution or "",
                project.department or "",
                project.research_area or "",
                project.degree_type or "",
                project.academic_year or "",
                project.supervisor or "",
                "Yes" if project.is_published else "No",
                project.created_at.strftime("%Y-%m-%d %H:%M:%S") if project.created_at else "",
                project.view_count or 0,
                project.download_count or 0,
                "Yes" if project.document_data else "No",
                image_count
            ])
        
        # Return CSV file
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=projects_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    except Exception as e:
        logger.error(f"Failed to export projects to CSV: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export projects")

# Utility endpoints
@router.get("/research-areas/list")
async def get_research_areas(
    current_user: User = Depends(get_current_active_user)
):
    """Get predefined research areas"""
    return RESEARCH_AREAS

@router.get("/degree-types/list")
async def get_degree_types(
    current_user: User = Depends(get_current_active_user)
):
    """Get predefined degree types"""
    return DEGREE_TYPES

@router.get("/academic-years/list")
async def get_academic_years(
    current_user: User = Depends(get_current_active_user)
):
    """Get predefined academic years"""
    return ACADEMIC_YEARS

@router.get("/institutions/list")
async def get_institutions(
    current_user: User = Depends(get_current_active_user)
):
    """Get predefined institutions"""
    return INSTITUTIONS

# Health check endpoint
@router.get("/health")
async def health_check():
    """Check if the projects API is working"""
    return {"status": "healthy", "service": "projects", "storage": "database"}
