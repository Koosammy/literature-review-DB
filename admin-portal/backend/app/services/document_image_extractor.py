"""Adapter that wires the extraction engine (see ``extraction/``) into the
FastAPI app: runs it against an uploaded document and persists whatever it
finds via :class:`DatabaseImageService`.

The heavy lifting (table/figure detection, cropping, dedup) lives in
``extraction/pdf_engine.py`` and ``extraction/docx_engine.py``, which have
no FastAPI/SQLAlchemy dependencies and can be used standalone (see
``extraction/cli.py``). This module just adapts that engine's output to the
existing ``ProjectImage`` storage model, keeping the same public interface
the rest of the app already calls.
"""

import asyncio
import logging
from itertools import chain
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from .database_image_service import DatabaseImageService
from .extraction import ExtractionResult
from .extraction.docx_engine import DocxExtractor
from .extraction.pdf_engine import PdfExtractor

logger = logging.getLogger(__name__)


class DocumentImageExtractor:
    def __init__(self, db_image_service: DatabaseImageService):
        self.db_image_service = db_image_service
        self.pdf_extractor = PdfExtractor()
        self.docx_extractor = DocxExtractor(pdf_extractor=self.pdf_extractor)

    async def extract_images_from_document(
        self,
        document_data: bytes,
        filename: str,
        project_id: int,
        db: Session,
        extract_tables: bool = True,
    ) -> int:
        """Extract images and tables from a document and save them to the DB."""
        file_ext = Path(filename).suffix.lower()

        if file_ext == ".pdf":
            engine = self.pdf_extractor
        elif file_ext in (".docx", ".doc"):
            engine = self.docx_extractor
        else:
            return 0

        try:
            result: ExtractionResult = await asyncio.to_thread(
                engine.extract, document_data, include_tables=extract_tables
            )
        except Exception as exc:
            logger.error("Extraction failed for %s (project %s): %s", filename, project_id, exc)
            return 0

        for warning in result.warnings:
            logger.warning("Extraction warning for %s (project %s): %s", filename, project_id, warning)

        from ..models.project import Project, ProjectImage

        # Serialize extraction saves so simultaneous retries cannot insert
        # the same images or assign the same order within a project.
        if db.query(Project.id).filter_by(id=project_id).with_for_update().first() is None:
            return 0
        last_index = db.query(func.max(ProjectImage.order_index)).filter_by(project_id=project_id).scalar()
        start_index = 0 if last_index is None else last_index + 1
        saved_count = 0

        for item, is_figure in chain(
            ((table, False) for table in result.tables),
            ((figure, True) for figure in result.figures),
        ):
            caption_slug = _slugify(item.caption) if item.caption else item.filename_stub
            prefix = "figure_" if is_figure else "table_"
            if not caption_slug.startswith(prefix):
                caption_slug = prefix + caption_slug
            saved = await self.db_image_service.save_image_bytes_to_db(
                image_bytes=item.image_bytes,
                filename=f"{caption_slug}.png",
                project_id=project_id,
                db=db,
                order_index=start_index + saved_count,
                is_featured=is_figure and start_index == 0 and saved_count == 0,
            )
            if saved is not None:
                saved_count += 1
        db.commit()

        logger.info(
            "Extracted %s from %s for project %s (%s)",
            result.summary(),
            filename,
            project_id,
            f"{saved_count} saved",
        )
        return saved_count


def _slugify(text: str, max_len: int = 60) -> str:
    import re

    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[-\s]+", "_", slug).strip("_")
    return slug[:max_len] or "item"
