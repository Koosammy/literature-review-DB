from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from ..database import get_db
from ..models.user import User
from ..models.project import Project
from ..schemas.project import SupervisorProfile, SupervisorWork

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{user_id}", response_model=SupervisorProfile)
async def get_supervisor_profile(user_id: int, db: Session = Depends(get_db)):
    """Public profile for the supervisor click-through modal: photo, bio,
    and every published work they supervise -- clicking one of those in
    the modal takes the researcher straight to that project."""
    supervisor = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not supervisor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supervisor not found")

    published_works = [p for p in supervisor.supervised_projects if p.is_published]
    published_works.sort(key=lambda p: p.publication_date or p.created_at, reverse=True)

    return SupervisorProfile(
        id=supervisor.id,
        title=supervisor.title,
        full_name=supervisor.full_name,
        institution=supervisor.institution,
        about=supervisor.about,
        profile_image=supervisor.profile_image,
        works_count=len(published_works),
        works=[SupervisorWork.model_validate(p) for p in published_works],
    )
