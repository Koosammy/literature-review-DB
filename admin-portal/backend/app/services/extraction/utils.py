"""Small geometry/hash helpers used by the extraction engines."""

from __future__ import annotations

import hashlib
from typing import List, Optional, Sequence

from .models import BBox


def bbox_area(b: BBox) -> float:
    x0, y0, x1, y1 = b
    return max(0.0, x1 - x0) * max(0.0, y1 - y0)


def bbox_intersection_area(a: BBox, b: BBox) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) * (iy1 - iy0)


def overlap_ratio(a: BBox, b: BBox) -> float:
    """Fraction of the *smaller* box's area that is covered by the overlap.

    Used to decide whether a candidate figure region is "really" a table
    that was already extracted, or a near-duplicate of another figure.
    """
    inter = bbox_intersection_area(a, b)
    if inter <= 0:
        return 0.0
    smaller = min(bbox_area(a), bbox_area(b))
    if smaller <= 0:
        return 0.0
    return inter / smaller


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pad_bbox(b: BBox, pad: float, clamp: Optional[BBox] = None) -> BBox:
    x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    if clamp is not None:
        cx0, cy0, cx1, cy1 = clamp
        x0, y0 = max(x0, cx0), max(y0, cy0)
        x1, y1 = min(x1, cx1), min(y1, cy1)
    return (x0, y0, x1, y1)


def rows_look_like_table(rows: Sequence[Sequence[Optional[str]]]) -> bool:
    """Structural sanity check for a detected table's cell grid.

    The detectors (PyMuPDF / pdfplumber) already locate tables geometrically
    -- via ruling lines or aligned whitespace gutters -- so this only needs
    to reject near-empty grids and paragraphs of prose that a text-alignment
    heuristic mistook for a single-column "table". It deliberately does NOT
    require specific keywords or numeric/date content: a table of plain text
    (e.g. author names, categories) is still a valid table.
    """
    if len(rows) < 2:
        return False

    ncols = max((len(r) for r in rows), default=0)
    if ncols < 2:
        return False

    cells = [str(c).strip() for r in rows for c in r if c is not None]
    nonempty = [c for c in cells if c]
    total_cells = sum(len(r) for r in rows)
    if total_cells == 0 or len(nonempty) / total_cells < 0.25:
        return False

    avg_len = sum(len(c) for c in nonempty) / max(len(nonempty), 1)
    # A "table" with very few columns and long free-text cells is almost
    # always a mis-detected paragraph rather than tabular data.
    if ncols <= 2 and avg_len > 60:
        return False

    return True


def normalize_rows(rows: List[List[Optional[str]]]) -> List[List[str]]:
    ncols = max((len(r) for r in rows), default=0)
    out = []
    for r in rows:
        row = [("" if c is None else str(c).strip()) for c in r]
        row += [""] * (ncols - len(row))
        out.append(row)
    return out


def looks_like_header_row(header: Sequence[str], body: Sequence[Sequence[str]]) -> bool:
    """Is the first row a real header, as opposed to a first data row?

    Deliberately does NOT require the cells to be unique: a merged header
    cell (e.g. a "Delivery" cell spanning two sub-columns "Skilled" /
    "Unskilled" via a Word gridSpan) legitimately produces the same label
    for more than one column, and that's still a perfectly good header.
    """
    if not header:
        return False
    nonempty = [h for h in header if h and h.strip()]
    if len(nonempty) < max(1, len(header) // 2):
        return False
    if body and list(header) == list(body[0]):
        return False
    return True


def dedupe_column_names(names: Sequence[str]) -> List[str]:
    """Make column labels safe for a DataFrame while keeping real names.

    Repeats (from a merged header cell spanning several columns) get a
    " (2)", " (3)", ... suffix instead of being discarded in favor of a
    meaningless "col_1" placeholder.
    """
    seen: dict = {}
    out = []
    for raw in names:
        name = (raw or "").strip() or "Unnamed"
        if name in seen:
            seen[name] += 1
            out.append(f"{name} ({seen[name]})")
        else:
            seen[name] = 1
            out.append(name)
    return out
