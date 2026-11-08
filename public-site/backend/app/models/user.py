"""Read-only mirror of the admin-portal's `users` table.

Public-site shares the same physical database (see database.py) but has no
auth of its own -- this model exists purely so supervisor info (name,
title, school, photo, bio) can be joined onto a project and displayed.
Account-sensitive columns (email, hashed_password, role, reset tokens,
etc.) are deliberately left unmapped even though they exist on the table.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func, inspect
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.orm import Session, relationship
from .base import Base
from .project import project_supervisors


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(20), nullable=True)
    full_name = Column(String(255), nullable=False)
    institution = Column(String(255))
    profile_image = Column(String, nullable=True)
    about = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supervised_projects = relationship(
        "Project",
        secondary="project_supervisors",
        back_populates="supervisors",
    )


def supervisor_schema_ready(db: Session) -> bool:
    # The admin backend can apply schema changes while the public API is running.
    inspector = inspect(db.connection())
    if not inspector.has_table(project_supervisors.name):
        return False

    try:
        user_columns = {column["name"] for column in inspector.get_columns(User.__tablename__)}
    except NoSuchTableError:
        return False
    return set(User.__table__.columns.keys()).issubset(user_columns)
