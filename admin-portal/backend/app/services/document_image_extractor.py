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
import json
import logging
import os
import signal
import sys
from contextlib import suppress
from itertools import chain
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import func
from sqlalchemy.orm import Session

from .database_image_service import DatabaseImageService
logger = logging.getLogger(__name__)


class ExtractionError(RuntimeError):
    """The document could not be processed by the extraction subprocess."""


class DocumentImageExtractor:
    def __init__(self, db_image_service: DatabaseImageService):
        self.db_image_service = db_image_service
        self.extraction_slot = asyncio.Semaphore(1)

    async def _run_extraction(self, source: Path, output: Path, extract_tables: bool) -> None:
        # PyMuPDF requires process isolation. Limit simultaneous conversions
        # so repeated clicks or background jobs cannot start multiple renderers.
        async with self.extraction_slot:
            args = [
                sys.executable, "-X", "faulthandler", "-m", "extraction.cli",
                str(source), "--out", str(output),
            ]
            if not extract_tables:
                args.append("--no-tables")
            process = await asyncio.create_subprocess_exec(
                *args,
                cwd=Path(__file__).resolve().parent,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=os.name == "posix",
            )
            try:
                _, stderr = await process.communicate()
            except asyncio.CancelledError:
                with suppress(ProcessLookupError):
                    if os.name == "posix":
                        os.killpg(process.pid, signal.SIGKILL)
                    else:
                        process.kill()
                await process.wait()
                raise
            if process.returncode:
                logger.error(
                    "Document extraction subprocess exited with status %s: %s",
                    process.returncode, stderr.decode(errors="replace")[-4000:],
                )
                raise ExtractionError(
                    "The extractor stopped while processing this document. No images were saved by this attempt."
                )

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
        if file_ext not in (".pdf", ".docx", ".doc"):
            return 0

        with TemporaryDirectory(prefix="research-hub-extraction-") as directory:
            source = Path(directory) / f"document{file_ext}"
            output = Path(directory) / "output"
            source.write_bytes(document_data)
            logger.info("Starting document extraction for project %s", project_id)
            try:
                await asyncio.wait_for(self._run_extraction(source, output, extract_tables), timeout=105)
            except asyncio.TimeoutError as exc:
                raise ExtractionError("Document extraction timed out. Try again when the backend is idle.") from exc

            result = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            for warning in result["warnings"]:
                logger.warning("Extraction warning for project %s: %s", project_id, warning)

            from ..models.project import Project, ProjectImage

            # Serialize extraction saves so retries cannot insert duplicate
            # images or assign the same order within a project.
            if db.query(Project.id).filter_by(id=project_id).with_for_update().first() is None:
                return 0
            last_index = db.query(func.max(ProjectImage.order_index)).filter_by(project_id=project_id).scalar()
            start_index = 0 if last_index is None else last_index + 1
            saved_count = 0

            for item, prefix in chain(
                ((table, "table_") for table in result["tables"]),
                ((figure, "figure_") for figure in result["figures"]),
            ):
                path = output / item["image"]
                caption_slug = _slugify(item["caption"]) if item["caption"] else path.stem
                if not caption_slug.startswith(prefix):
                    caption_slug = prefix + caption_slug
                saved = await self.db_image_service.save_image_bytes_to_db(
                    image_bytes=path.read_bytes(),
                    filename=f"{caption_slug}.png",
                    project_id=project_id,
                    db=db,
                    order_index=start_index + saved_count,
                    is_featured=prefix == "figure_" and start_index == 0 and saved_count == 0,
                )
                if saved is not None:
                    saved_count += 1
            db.commit()

        logger.info("Saved %s extracted images for project %s", saved_count, project_id)
        return saved_count


def _slugify(text: str, max_len: int = 60) -> str:
    import re

    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[-\s]+", "_", slug).strip("_")
    return slug[:max_len] or "item"
