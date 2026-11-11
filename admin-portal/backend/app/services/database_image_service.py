import io
from typing import Optional, List
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image
from pathlib import Path

from ..models.project import ProjectImage

class DatabaseImageService:
    def __init__(self):
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        self.max_dimensions = (4000, 4000)

    async def save_image_to_db(
        self, 
        file: UploadFile, 
        project_id: int, 
        db: Session,
        order_index: int = 0,
        is_featured: bool = False
    ) -> ProjectImage:
        """Save uploaded image to database"""
        # Validate file
        await self._validate_image(file)
        
        # Read file content
        content = await file.read()
        
        # Optimize image
        optimized_content = await self._optimize_image_bytes(content, file.filename)
        
        # Determine content type
        content_type = self._get_content_type(file.filename)
        
        # Create database record
        db_image = ProjectImage(
            project_id=project_id,
            filename=file.filename,
            content_type=content_type,
            image_size=len(optimized_content),
            image_data=optimized_content,
            order_index=order_index,
            is_featured=is_featured
        )
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return db_image

    async def save_image_bytes_to_db(
        self,
        image_bytes: bytes,
        filename: str,
        project_id: int,
        db: Session,
        order_index: int = 0,
        is_featured: bool = False
    ) -> ProjectImage | None:
        """Stage a new extracted image unless the project already has it."""
        # Optimize image
        optimized_content = await self._optimize_image_bytes(image_bytes, filename)
        
        existing = db.query(ProjectImage.id).filter_by(
            project_id=project_id, filename=filename, image_data=optimized_content,
        ).first()
        if existing is not None:
            return None

        # Determine content type
        content_type = self._get_content_type(filename)
        
        # Create database record
        db_image = ProjectImage(
            project_id=project_id,
            filename=filename,
            content_type=content_type,
            image_size=len(optimized_content),
            image_data=optimized_content,
            order_index=order_index,
            is_featured=is_featured
        )
        
        db.add(db_image)
        db.flush()
        
        return db_image

    def _get_content_type(self, filename: str) -> str:
        """Get content type from filename"""
        ext = Path(filename).suffix.lower()
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return content_types.get(ext, 'image/png')

    async def _validate_image(self, file: UploadFile) -> None:
        """Validate uploaded image"""
        # Check extension
        ext = Path(file.filename).suffix.lower()
        if ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(self.allowed_extensions)}"
            )
        
        # Check file size
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        
        if size > self.max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {self.max_file_size // 1024 // 1024}MB"
            )

    async def _optimize_image_bytes(self, image_bytes: bytes, filename: str) -> bytes:
        """Optimize image bytes for storage"""
        try:
            # Open image
            img = Image.open(io.BytesIO(image_bytes))
            
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])
                else:
                    background.paste(img)
                img = background
            
            # Resize if too large
            max_size = 2000
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Save to bytes
            output = io.BytesIO()
            format = 'JPEG' if filename.lower().endswith(('.jpg', '.jpeg')) else 'PNG'
            img.save(output, format=format, optimize=True, quality=85)
            
            return output.getvalue()
        except Exception:
            # If optimization fails, return original
            return image_bytes
