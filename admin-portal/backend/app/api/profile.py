from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import io
import logging

from PIL import Image, UnidentifiedImageError

from app.database import get_db
from app.models.user import User
from app.api.auth import get_current_user

# Add logging
logger = logging.getLogger(__name__)

router = APIRouter()

MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_PROFILE_TYPES = {"image/jpeg", "image/png", "image/webp"}

# Profile update schema
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    about: Optional[str] = None
    disciplines: Optional[str] = None

def _profile_image_url(request: Request, user_id: int) -> str:
    # Build the URL from the backend request that successfully reached this
    # service. This avoids stale or renamed Render hostnames in BACKEND_URL.
    return str(request.url_for("serve_profile_image", user_id=user_id))


def _profile_response_image(request: Request, user: User) -> Optional[str]:
    return _profile_image_url(request, user.id) if user.profile_image_data else user.profile_image


def _profile_image_storage_status(user: User) -> Dict[str, Any]:
    image_data = user.profile_image_data
    return {
        "storage_backend": "database",
        "profile_image_url": user.profile_image if image_data else None,
        "has_image_data": image_data is not None,
        "image_size_bytes": len(image_data) if image_data else 0,
        "content_type": user.profile_image_content_type,
    }


async def _save_profile_image(
    request: Request,
    file: UploadFile,
    current_user: User,
    db: Session,
) -> Dict[str, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_PROFILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Profile photo must be JPEG, PNG, or WebP.",
        )

    image_bytes = await file.read(MAX_PROFILE_IMAGE_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(image_bytes) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Profile photo must not exceed 5 MB.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    try:
        current_user.profile_image_data = image_bytes
        current_user.profile_image_content_type = content_type
        # Store a stable public URL instead of an ephemeral filesystem path.
        current_user.profile_image = _profile_image_url(request, current_user.id)
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        logger.exception("Failed to store profile photo for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Could not save the profile photo.")

    return {
        "image_url": f"{current_user.profile_image}?v={int(datetime.utcnow().timestamp())}",
        "path": current_user.profile_image,
    }


@router.post("/image")
async def upload_profile_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Upload the first profile photo or replace the existing one."""
    return await _save_profile_image(request, file, current_user, db)


@router.put("/image")
async def change_profile_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Explicit route for an authenticated user to change their profile photo."""
    return await _save_profile_image(request, file, current_user, db)


@router.get("/image/{user_id}")
async def serve_profile_image(user_id: int, db: Session = Depends(get_db)) -> Response:
    """Serve a public profile photo directly from PostgreSQL."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user or not user.profile_image_data:
        raise HTTPException(status_code=404, detail="Profile photo not found.")

    return Response(
        content=bytes(user.profile_image_data),
        media_type=user.profile_image_content_type or "image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.delete("/image")
async def delete_profile_image(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Delete the current user's database-backed profile photo."""
    try:
        current_user.profile_image = None
        current_user.profile_image_data = None
        current_user.profile_image_content_type = None
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete the profile photo.")

    return {"message": "Profile image deleted successfully"}


@router.put("")
async def update_profile(
    request: Request,
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update user profile information"""
    try:
        # Log incoming data
        logger.info(f"Updating profile for user {current_user.id}")
        logger.info(f"Update data: {profile_data.dict(exclude_unset=True)}")
        
        # Update only provided fields
        update_data = profile_data.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if hasattr(current_user, field):
                setattr(current_user, field, value)
                logger.info(f"Set {field} = {value}")
        
        db.commit()
        db.refresh(current_user)
        
        # Log what we're returning
        response_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "institution": current_user.institution,
            "department": current_user.department,
            "phone": current_user.phone,
            "about": current_user.about,
            "disciplines": current_user.disciplines,
            "profile_image": _profile_response_image(request, current_user),
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        }
        
        logger.info(f"Returning response: {response_data}")
        return response_data
        
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
async def get_profile(
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current user's profile"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "institution": current_user.institution,
        "department": current_user.department,
        "phone": current_user.phone,
        "about": current_user.about,
        "disciplines": current_user.disciplines,
        "profile_image": current_user.profile_image,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }

@router.get("/debug")
async def debug_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Debug endpoint to check current database values"""
    # Refresh from database
    db.refresh(current_user)
    
    return {
        "database_values": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "institution": current_user.institution,
            "department": current_user.department,
            "phone": current_user.phone,
            "about": current_user.about,
            "disciplines": current_user.disciplines,
            "profile_image": current_user.profile_image,
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/image/debug")
async def debug_profile_image(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Report database-backed profile image state without inspecting disk."""
    db.refresh(current_user)
    return _profile_image_storage_status(current_user)
