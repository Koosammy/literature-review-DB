"""Data types shared by the extraction engines."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import pandas as pd

BBox = Tuple[float, float, float, float]  # (x0, y0, x1, y1) in PDF points


@dataclass
class ExtractedTable:
    page_number: int  # 1-based
    index_on_page: int  # 0-based order within the page
    bbox: BBox
    dataframe: pd.DataFrame
    image_bytes: bytes  # pixel-accurate crop of the source page region (PNG)
    source: str  # 'pymupdf' | 'pdfplumber' | 'docx-text'
    caption: Optional[str] = None

    @property
    def csv_text(self) -> str:
        return self.dataframe.to_csv(index=False)

    @property
    def filename_stub(self) -> str:
        return f"table_p{self.page_number}_{self.index_on_page + 1}"


@dataclass
class ExtractedFigure:
    page_number: int
    index_on_page: int
    bbox: BBox
    image_bytes: bytes  # PNG
    width: int
    height: int
    source: str  # 'embedded-raster' | 'vector-cluster' | 'docx-media'
    caption: Optional[str] = None

    @property
    def filename_stub(self) -> str:
        return f"figure_p{self.page_number}_{self.index_on_page + 1}"


@dataclass
class ExtractionResult:
    tables: List[ExtractedTable] = field(default_factory=list)
    figures: List[ExtractedFigure] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"{len(self.tables)} table(s), {len(self.figures)} figure(s), "
            f"{len(self.warnings)} warning(s)"
        )
