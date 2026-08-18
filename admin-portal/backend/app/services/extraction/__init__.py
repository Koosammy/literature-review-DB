"""Table and figure extraction engine for PDF and DOCX documents.

This package is intentionally free of FastAPI/SQLAlchemy dependencies so it
can be used as a standalone library or CLI, independent of how (or whether)
results get persisted. See ``cli.py`` for command-line usage and
``../document_image_extractor.py`` for the adapter that saves results into
the application's database.
"""

from .models import ExtractedFigure, ExtractedTable, ExtractionResult
from .pdf_engine import PdfExtractor
from .docx_engine import DocxExtractor

__all__ = [
    "ExtractedFigure",
    "ExtractedTable",
    "ExtractionResult",
    "PdfExtractor",
    "DocxExtractor",
]
