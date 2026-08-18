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

        from .utils import dedupe_column_names, looks_like_header_row, normalize_rows, rows_look_like_table

        tables: List[ExtractedTable] = []
        try:
            doc = Document(_io.BytesIO(data))
        except Exception as exc:
            logger.warning("python-docx failed to open document: %s", exc)
            return tables

        for idx, table in enumerate(doc.tables):
            # `row.cells` already resolves gridSpan/vMerge (a merged header
            # cell spanning several columns, e.g. "Delivery" over
            # "Skilled"/"Unskilled" sub-columns, correctly repeats its text
            # into each spanned column) -- no raw XML walking needed here.
            rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            rows = normalize_rows(rows)
            if not rows_look_like_table(rows):
                continue

            header, *body = rows
            if looks_like_header_row(header, body):
                df = pd.DataFrame(body, columns=dedupe_column_names(header))
            else:
                df = pd.DataFrame(rows, columns=[f"Column {i + 1}" for i in range(len(rows[0]))])

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
        """Draw the table with real text measurement so columns/rows autofit
        to their content and text never overlaps.

        matplotlib's ``ax.table`` cells have fixed heights and don't wrap
        text, which overlaps or clips anything longer than the cell -- so
        this draws directly with Pillow instead, using the TrueType fonts
        matplotlib already bundles (no new dependency) for exact pixel
        measurement of each line before laying out the grid.
        """
        import io as _io

        import matplotlib
        from PIL import Image, ImageDraw, ImageFont

        font_dir = Path(matplotlib.get_data_path()) / "fonts" / "ttf"
        font_size, title_font_size = 15, 20
        regular_font = ImageFont.truetype(str(font_dir / "DejaVuSans.ttf"), font_size)
        bold_font = ImageFont.truetype(str(font_dir / "DejaVuSans-Bold.ttf"), font_size)
        title_font = ImageFont.truetype(str(font_dir / "DejaVuSans-Bold.ttf"), title_font_size)

        columns = [str(c) for c in df.columns]
        rows = [["" if pd.isna(v) else str(v) for v in row] for row in df.itertuples(index=False, name=None)]
        n_cols = len(columns)

        pad_x, pad_y, line_gap = 12, 8, 4
        min_col_w, max_col_w = 90, 280

        measure_img = Image.new("RGB", (1, 1))
        measure_draw = ImageDraw.Draw(measure_img)

        def text_width(s: str, font: ImageFont.FreeTypeFont) -> float:
            return measure_draw.textlength(s, font=font)

        def line_height(font: ImageFont.FreeTypeFont) -> int:
            bbox = font.getbbox("Ag")
            return (bbox[3] - bbox[1]) + line_gap

        def wrap(text: str, font: ImageFont.FreeTypeFont, col_width: int) -> List[str]:
            avail = max(col_width - 2 * pad_x, 10)
            lines: List[str] = []
            for para in str(text).split("\n"):
                if not para:
                    lines.append("")
                    continue
                words = para.split(" ")
                current = words[0]
                for word in words[1:]:
                    candidate = f"{current} {word}"
                    if text_width(candidate, font) <= avail:
                        current = candidate
                    else:
                        lines.append(current)
                        current = word
                lines.append(current)
            return lines or [""]

        # Column widths: size to the longest line each column actually
        # contains (header or data), clamped to a sane min/max so one long
        # cell can't blow out the whole table -- it wraps instead.
        col_widths = []
        for c in range(n_cols):
            natural = max((text_width(part, bold_font) for part in columns[c].split("\n")), default=0)
            for row in rows:
                for part in row[c].split("\n"):
                    natural = max(natural, text_width(part, regular_font))
            col_widths.append(int(min(max(natural + 2 * pad_x, min_col_w), max_col_w)))

        header_lines = [wrap(columns[c], bold_font, col_widths[c]) for c in range(n_cols)]
        header_h = max((len(lines) for lines in header_lines), default=1) * line_height(bold_font) + 2 * pad_y

        body_lines: List[List[List[str]]] = []
        row_heights: List[int] = []
        reg_line_h = line_height(regular_font)
        for row in rows:
            cell_lines = [wrap(row[c], regular_font, col_widths[c]) for c in range(n_cols)]
            body_lines.append(cell_lines)
            row_heights.append(max((len(cl) for cl in cell_lines), default=1) * reg_line_h + 2 * pad_y)

        table_w = sum(col_widths)
        title_h = line_height(title_font) + 2 * pad_y if title else 0
        table_h = header_h + sum(row_heights)

        img = Image.new("RGB", (table_w + 1, title_h + table_h + 1), "white")
        draw = ImageDraw.Draw(img)

        y = 0
        if title:
            draw.text((table_w / 2, title_h / 2), title, font=title_font, fill="#1a1a1a", anchor="mm")
            y = title_h

        header_top = y
        draw.rectangle([0, y, table_w, y + header_h], fill=(46, 92, 138))
        x = 0
        for c in range(n_cols):
            cy = y + pad_y
            for line in header_lines[c]:
                draw.text((x + pad_x, cy), line, font=bold_font, fill="white")
                cy += line_height(bold_font)
            x += col_widths[c]
        y += header_h

        for r_idx, cell_lines in enumerate(body_lines):
            rh = row_heights[r_idx]
            draw.rectangle([0, y, table_w, y + rh], fill="#f2f2f2" if r_idx % 2 else "white")
            x = 0
            for c in range(n_cols):
                cy = y + pad_y
                for line in cell_lines[c]:
                    draw.text((x + pad_x, cy), line, font=regular_font, fill="#222222")
                    cy += reg_line_h
                x += col_widths[c]
            y += rh

        border = "#999999"
        x = 0
        for c in range(n_cols + 1):
            draw.line([(x, header_top), (x, header_top + table_h)], fill=border)
            if c < n_cols:
                x += col_widths[c]
        y = header_top
        draw.line([(0, y), (table_w, y)], fill=border)
        y += header_h
        draw.line([(0, y), (table_w, y)], fill=border)
        for rh in row_heights:
            y += rh
            draw.line([(0, y), (table_w, y)], fill=border)

        buf = _io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()
