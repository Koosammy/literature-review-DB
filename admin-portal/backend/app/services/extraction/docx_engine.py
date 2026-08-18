"""DOCX table and figure extraction.

Strategy: DOCX has no fixed page layout, so there is no way to "crop the
real page" the way the PDF engine does. Instead we convert the document to
PDF with a headless LibreOffice (which renders it exactly as Word would)
and reuse :class:`PdfExtractor` on the result -- this gives DOCX tables the
same pixel-accurate crops as PDF tables, including merged cells and
multi-line headers that a from-scratch re-typeset would get wrong.

Embedded images are read directly from the .docx zip (``word/media/*``)
rather than from the converted PDF, since that avoids an extra lossy
re-encode. If LibreOffice isn't installed, we fall back to a pure
python-docx table reader (cell text only, no pixel-perfect crop) so the
tool still works, just with lower table fidelity.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import List, Optional

import pandas as pd

from .models import ExtractedFigure, ExtractedTable, ExtractionResult
from .pdf_engine import PdfExtractor
from .utils import sha256_bytes

logger = logging.getLogger(__name__)


class DocxExtractor:
    def __init__(
        self,
        *,
        pdf_extractor: Optional[PdfExtractor] = None,
        min_image_bytes: int = 4000,
        libreoffice_timeout: int = 90,
    ) -> None:
        self.pdf_extractor = pdf_extractor or PdfExtractor()
        self.min_image_bytes = min_image_bytes
        self.libreoffice_timeout = libreoffice_timeout

    def extract(self, data: bytes) -> ExtractionResult:
        result = ExtractionResult()

        media_images = self._extract_media_images(data)
        result.figures.extend(media_images)

        pdf_bytes = self._convert_to_pdf(data)
        if pdf_bytes is not None:
            pdf_result = self.pdf_extractor.extract(pdf_bytes)
            result.tables.extend(pdf_result.tables)
            for t in result.tables:
                t.source = "docx-via-pdf"
            # Only keep vector-drawn figures from the PDF route; raster
            # images are already covered (at original quality) by the
            # direct zip extraction above.
            vector_figs = [f for f in pdf_result.figures if f.source == "vector-cluster"]
            for i, f in enumerate(vector_figs, start=len(result.figures)):
                f.index_on_page = i
            result.figures.extend(vector_figs)
            result.warnings.extend(pdf_result.warnings)
        else:
            result.warnings.append(
                "LibreOffice was unavailable; falling back to text-only table extraction "
                "(tables will not have pixel-accurate images)."
            )
            result.tables.extend(self._extract_tables_fallback(data))

        if not result.tables and not result.figures:
            result.warnings.append("No tables or figures were detected in this document.")

        return result

    # ------------------------------------------------------------------ #
    # Images straight from the .docx zip
    # ------------------------------------------------------------------ #
    def _extract_media_images(self, data: bytes) -> List[ExtractedFigure]:
        import io

        figures: List[ExtractedFigure] = []
        seen_hashes = set()
        idx = 0
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for info in zf.infolist():
                    if not info.filename.startswith("word/media/") or info.is_dir():
                        continue
                    raw = zf.read(info.filename)

                    ext = Path(info.filename).suffix.lower()
                    if ext in (".emf", ".wmf"):
                        # Legacy vector metafile formats Pillow/browsers can't
                        # render; skip rather than saving an unusable file.
                        continue

                    width, height = self._image_dimensions(raw)
                    # A decorative icon is usually both small in file size and
                    # small in pixels; a simple-but-real diagram can be small
                    # in one dimension without being small in the other (e.g.
                    # a clean vector-style PNG compresses very well but is
                    # still a full-size figure), so only drop images that are
                    # small on *both* axes.
                    is_small_bytes = len(raw) < self.min_image_bytes
                    is_small_pixels = width < 100 or height < 100
                    if is_small_bytes and is_small_pixels:
                        continue

                    h = sha256_bytes(raw)
                    if h in seen_hashes:
                        continue
                    seen_hashes.add(h)
                    figures.append(
                        ExtractedFigure(
                            page_number=0,
                            index_on_page=idx,
                            bbox=(0, 0, float(width or 0), float(height or 0)),
                            image_bytes=raw,
                            width=width or 0,
                            height=height or 0,
                            source="docx-media",
                        )
                    )
                    idx += 1
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed reading DOCX media images: %s", exc)

        return figures

    def _image_dimensions(self, raw: bytes):
        try:
            from PIL import Image
            import io

            with Image.open(io.BytesIO(raw)) as img:
                return img.width, img.height
        except Exception:
            return 0, 0

    # ------------------------------------------------------------------ #
    # LibreOffice conversion
    # ------------------------------------------------------------------ #
    def _convert_to_pdf(self, data: bytes) -> Optional[bytes]:
        soffice = shutil.which("soffice") or shutil.which("libreoffice")
        if not soffice:
            return None

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            src = tmp_path / "input.docx"
            src.write_bytes(data)
            try:
                subprocess.run(
                    [
                        soffice,
                        "--headless",
                        "--norestore",
                        "--convert-to",
                        "pdf",
                        "--outdir",
                        str(tmp_path),
                        str(src),
                    ],
                    check=True,
                    timeout=self.libreoffice_timeout,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
            except Exception as exc:
                logger.warning("LibreOffice conversion failed: %s", exc)
                return None

            out = tmp_path / "input.pdf"
            if not out.exists():
                return None
            return out.read_bytes()

    # ------------------------------------------------------------------ #
    # Fallback: text-only tables via python-docx (no LibreOffice)
    # ------------------------------------------------------------------ #
    def _extract_tables_fallback(self, data: bytes) -> List[ExtractedTable]:
        import io as _io

        from docx import Document

        from .utils import normalize_rows, rows_look_like_table

        tables: List[ExtractedTable] = []
        try:
            doc = Document(_io.BytesIO(data))
        except Exception as exc:
            logger.warning("python-docx failed to open document: %s", exc)
            return tables

        for idx, table in enumerate(doc.tables):
            rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            rows = normalize_rows(rows)
            if not rows_look_like_table(rows):
                continue

            header, *body = rows
            if header and all(h for h in header) and len(set(header)) == len(header):
                df = pd.DataFrame(body, columns=header)
            else:
                df = pd.DataFrame(rows, columns=[f"col_{i + 1}" for i in range(len(rows[0]))])

            image_bytes = self._render_table_image(df, f"Table {idx + 1}")
            tables.append(
                ExtractedTable(
                    page_number=0,
                    index_on_page=idx,
                    bbox=(0, 0, 0, 0),
                    dataframe=df,
                    image_bytes=image_bytes,
                    source="docx-text",
                )
            )

        return tables

    def _render_table_image(self, df: pd.DataFrame, title: str) -> bytes:
        import io as _io

        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        n_rows, n_cols = df.shape
        fig_width = max(6, min(20, n_cols * 2.2))
        fig_height = max(2, min(15, (n_rows + 2) * 0.4))

        fig, ax = plt.subplots(figsize=(fig_width, fig_height))
        ax.axis("off")
        tbl = ax.table(cellText=df.values, colLabels=df.columns, cellLoc="left", loc="center")
        tbl.auto_set_font_size(False)
        tbl.set_fontsize(10)
        tbl.scale(1, 1.4)
        ax.set_title(title, fontsize=12, fontweight="bold")

        buf = _io.BytesIO()
        fig.savefig(buf, format="png", dpi=200, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf.read()
