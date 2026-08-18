"""PDF table and figure extraction.

Design notes (why this differs from a naive pdfplumber/camelot pipeline):

* Tables are *detected* geometrically with PyMuPDF's built-in table finder
  (ruling lines / aligned text gutters), which needs no external binary
  (unlike Camelot, which shells out to Ghostscript). pdfplumber is used as a
  page-level fallback for the rare page where PyMuPDF finds nothing.
* Once a table's bounding box is known, the saved image is a high-DPI crop
  of the *actual* page content, not a re-typeset matplotlib/plotly table.
  Re-typesetting loses merged cells, multi-line headers, footnote markers
  and original styling; cropping the real page never does.
* Figures include not just embedded raster images but also vector-drawn
  charts (native PDF line/fill drawings, e.g. a matplotlib/Excel chart
  exported as vectors), which `Page.get_images()`-based approaches miss
  entirely. These are found with PyMuPDF's `cluster_drawings()`.
* Repeated images (running headers, logos, watermarks that appear on most
  pages) are dropped via content hashing so they don't pollute the figure
  gallery.
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional

import pandas as pd
import pymupdf as fitz

from .models import BBox, ExtractedFigure, ExtractedTable, ExtractionResult
from .utils import normalize_rows, overlap_ratio, pad_bbox, rows_look_like_table, sha256_bytes

logger = logging.getLogger(__name__)

_CAPTION_RE = re.compile(r"^\s*(fig(?:ure)?\.?|table)\s*[:.\-]?\s*\d+", re.IGNORECASE)


class PdfExtractor:
    def __init__(
        self,
        *,
        table_zoom: float = 3.0,
        figure_zoom: float = 3.0,
        min_table_rows: int = 2,
        min_table_cols: int = 2,
        min_image_bytes: int = 300,
        min_image_dim: int = 80,
        min_vector_cluster_area: float = 2500.0,  # ~50x50 pt
        repeated_image_page_ratio: float = 0.6,
        table_overlap_reject_ratio: float = 0.35,
        caption_search_margin: float = 45.0,
    ) -> None:
        self.table_zoom = table_zoom
        self.figure_zoom = figure_zoom
        self.min_table_rows = min_table_rows
        self.min_table_cols = min_table_cols
        self.min_image_bytes = min_image_bytes
        self.min_image_dim = min_image_dim
        self.min_vector_cluster_area = min_vector_cluster_area
        self.repeated_image_page_ratio = repeated_image_page_ratio
        self.table_overlap_reject_ratio = table_overlap_reject_ratio
        self.caption_search_margin = caption_search_margin

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def extract(self, data: bytes) -> ExtractionResult:
        result = ExtractionResult()
        doc = fitz.open(stream=data, filetype="pdf")
        try:
            table_bboxes_by_page: dict[int, List[BBox]] = {}

            for page_index in range(len(doc)):
                page = doc[page_index]
                page_no = page_index + 1
                try:
                    tables = self._extract_tables_for_page(page, page_no)
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("Table extraction failed on page %s: %s", page_no, exc)
                    result.warnings.append(f"Table extraction failed on page {page_no}: {exc}")
                    tables = []
                result.tables.extend(tables)
                table_bboxes_by_page[page_index] = [t.bbox for t in tables]

            image_hash_page_counts: dict[str, set] = {}
            page_raw_images: List[List[ExtractedFigure]] = []
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_no = page_index + 1
                raster = self._extract_raster_images(doc, page, page_no)
                page_raw_images.append(raster)
                for fig in raster:
                    h = sha256_bytes(fig.image_bytes)
                    image_hash_page_counts.setdefault(h, set()).add(page_no)

            n_pages = len(doc)
            repeated_hashes = {
                h
                for h, pages in image_hash_page_counts.items()
                if n_pages > 3 and len(pages) / n_pages >= self.repeated_image_page_ratio
            }

            for page_index in range(len(doc)):
                page = doc[page_index]
                page_no = page_index + 1
                kept_raster = []
                for fig in page_raw_images[page_index]:
                    if sha256_bytes(fig.image_bytes) in repeated_hashes:
                        continue
                    kept_raster.append(fig)

                try:
                    vector_figs = self._extract_vector_clusters(
                        page,
                        page_no,
                        exclude_bboxes=table_bboxes_by_page.get(page_index, [])
                        + [f.bbox for f in kept_raster],
                        start_index=len(kept_raster),
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("Vector figure detection failed on page %s: %s", page_no, exc)
                    result.warnings.append(f"Vector figure detection failed on page {page_no}: {exc}")
                    vector_figs = []

                for i, fig in enumerate(kept_raster):
                    fig.index_on_page = i
                result.figures.extend(kept_raster)
                result.figures.extend(vector_figs)

            if not result.tables and not result.figures:
                result.warnings.append("No tables or figures were detected in this document.")

            return result
        finally:
            doc.close()

    # ------------------------------------------------------------------ #
    # Tables
    # ------------------------------------------------------------------ #
    def _extract_tables_for_page(self, page: "fitz.Page", page_no: int) -> List[ExtractedTable]:
        tables: List[ExtractedTable] = []

        found = page.find_tables()
        candidates = list(found.tables) if found is not None else []
        source = "pymupdf"

        if not candidates:
            candidates = self._pdfplumber_tables_for_page(page)
            source = "pdfplumber"

        idx = 0
        for cand in candidates:
            bbox, rows = self._rows_from_candidate(cand, source)
            if bbox is None or rows is None:
                continue
            rows = normalize_rows(rows)
            if not rows_look_like_table(rows):
                continue
            if len(rows) < self.min_table_rows or len(rows[0]) < self.min_table_cols:
                continue

            df = self._rows_to_dataframe(rows)
            image_bytes = self._crop_page(page, bbox, self.table_zoom)
            caption = self._find_caption(page, bbox, prefer="table")

            tables.append(
                ExtractedTable(
                    page_number=page_no,
                    index_on_page=idx,
                    bbox=bbox,
                    dataframe=df,
                    image_bytes=image_bytes,
                    source=source,
                    caption=caption,
                )
            )
            idx += 1

        return tables

    def _pdfplumber_tables_for_page(self, page: "fitz.Page"):
        try:
            import pdfplumber
        except ImportError:
            return []

        try:
            # pdfplumber needs its own handle on the PDF bytes; re-opening
            # per page is wasteful for large docs, but this path only runs
            # for the (rare) pages PyMuPDF's detector skipped.
            pdf_bytes = page.parent.tobytes()
            import io as _io

            with pdfplumber.open(_io.BytesIO(pdf_bytes)) as plumber_pdf:
                plumber_page = plumber_pdf.pages[page.number]
                return plumber_page.find_tables()
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("pdfplumber fallback failed on page %s: %s", page.number + 1, exc)
            return []

    def _rows_from_candidate(self, cand, source: str):
        try:
            if source == "pymupdf":
                bbox = tuple(cand.bbox)
                rows = cand.extract()
            else:  # pdfplumber
                bbox = tuple(cand.bbox)
                rows = cand.extract()
            return bbox, rows
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Failed to extract table candidate: %s", exc)
            return None, None

    def _rows_to_dataframe(self, rows: List[List[str]]) -> pd.DataFrame:
        header, *body = rows
        # Use the first row as the header only if it doesn't have blank
        # cells (a genuine header row); otherwise fall back to generic names
        # so we never silently drop the first data row.
        if header and all(h.strip() for h in header) and len(set(header)) == len(header):
            df = pd.DataFrame(body, columns=header)
        else:
            ncols = len(rows[0])
            df = pd.DataFrame(rows, columns=[f"col_{i + 1}" for i in range(ncols)])
        return df

    # ------------------------------------------------------------------ #
    # Raster (embedded) images
    # ------------------------------------------------------------------ #
    def _extract_raster_images(self, doc: "fitz.Document", page: "fitz.Page", page_no: int) -> List[ExtractedFigure]:
        figures: List[ExtractedFigure] = []
        try:
            infos = page.get_image_info(xrefs=True)
        except Exception:
            infos = []

        seen_xrefs = set()
        idx = 0
        for info in infos:
            xref = info.get("xref", 0)
            if not xref or xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            bbox = tuple(info.get("bbox", (0, 0, 0, 0)))
            w, h = info.get("width", 0), info.get("height", 0)
            if w and h and (w < self.min_image_dim or h < self.min_image_dim):
                continue

            png_bytes = self._safe_pixmap_png(doc, xref)
            if png_bytes is None or len(png_bytes) < self.min_image_bytes:
                continue

            caption = self._find_caption(page, bbox, prefer="figure")
            figures.append(
                ExtractedFigure(
                    page_number=page_no,
                    index_on_page=idx,
                    bbox=bbox,
                    image_bytes=png_bytes,
                    width=w or 0,
                    height=h or 0,
                    source="embedded-raster",
                    caption=caption,
                )
            )
            idx += 1

        return figures

    def _safe_pixmap_png(self, doc: "fitz.Document", xref: int) -> Optional[bytes]:
        try:
            pix = fitz.Pixmap(doc, xref)
        except Exception:
            return None
        try:
            if pix.colorspace is None:
                # Stencil / soft mask with no color data of its own.
                return None
            color_channels = pix.n - (1 if pix.alpha else 0)
            if color_channels >= 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            return pix.tobytes("png")
        except Exception:
            return None

    # ------------------------------------------------------------------ #
    # Vector-drawn figures (charts made of native PDF paths, not images)
    # ------------------------------------------------------------------ #
    def _extract_vector_clusters(
        self,
        page: "fitz.Page",
        page_no: int,
        exclude_bboxes: List[BBox],
        start_index: int,
    ) -> List[ExtractedFigure]:
        figures: List[ExtractedFigure] = []
        try:
            clusters = page.cluster_drawings()
        except Exception:
            return figures

        idx = start_index
        for rect in clusters:
            bbox = (rect.x0, rect.y0, rect.x1, rect.y1)
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            area = w * h
            if area < self.min_vector_cluster_area:
                continue
            if w < 15 or h < 15:
                # Thin rules/underlines/dividers, not real figures.
                continue

            if any(overlap_ratio(bbox, ex) > self.table_overlap_reject_ratio for ex in exclude_bboxes):
                continue

            padded = pad_bbox(bbox, 4.0, clamp=tuple(page.rect))
            png_bytes = self._crop_page(page, padded, self.figure_zoom)
            if len(png_bytes) < self.min_image_bytes:
                continue

            caption = self._find_caption(page, bbox, prefer="figure")
            figures.append(
                ExtractedFigure(
                    page_number=page_no,
                    index_on_page=idx,
                    bbox=padded,
                    image_bytes=png_bytes,
                    width=int(w * self.figure_zoom),
                    height=int(h * self.figure_zoom),
                    source="vector-cluster",
                    caption=caption,
                )
            )
            idx += 1

        return figures

    # ------------------------------------------------------------------ #
    # Shared helpers
    # ------------------------------------------------------------------ #
    def _crop_page(self, page: "fitz.Page", bbox: BBox, zoom: float) -> bytes:
        clip = fitz.Rect(*pad_bbox(bbox, 2.0, clamp=tuple(page.rect)))
        pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(zoom, zoom))
        return pix.tobytes("png")

    def _find_caption(self, page: "fitz.Page", bbox: BBox, *, prefer: str) -> Optional[str]:
        try:
            blocks = page.get_text("blocks")
        except Exception:
            return None

        x0, y0, x1, y1 = bbox
        below: List[tuple] = []
        above: List[tuple] = []
        for b in blocks:
            bx0, by0, bx1, by1, text = b[0], b[1], b[2], b[3], b[4]
            text = (text or "").strip()
            if not text or not _CAPTION_RE.match(text):
                continue
            # Roughly horizontally aligned with the figure/table.
            if bx1 < x0 - 20 or bx0 > x1 + 20:
                continue

            if by0 >= y1 - 1:
                dist = by0 - y1
                if dist <= self.caption_search_margin:
                    below.append((dist, text))
            elif by1 <= y0 + 1:
                dist = y0 - by1
                if dist <= self.caption_search_margin:
                    above.append((dist, text))

        # Figure captions conventionally sit below; table captions above.
        # Prefer that zone, but fall back to the other if nothing matched.
        ordered = (below, above) if prefer == "figure" else (above, below)
        for zone in ordered:
            if zone:
                zone.sort(key=lambda item: item[0])
                return zone[0][1].splitlines()[0].strip()
        return None
