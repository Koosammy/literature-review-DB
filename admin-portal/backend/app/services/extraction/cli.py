"""Standalone CLI for the extraction engine.

Usage:
    python -m app.services.extraction.cli input.pdf --out output_dir
    python -m app.services.extraction.cli input.docx --out output_dir

Writes:
    output_dir/tables/table_pN_i.png   (pixel-accurate crop)
    output_dir/tables/table_pN_i.csv   (structured data)
    output_dir/figures/figure_pN_i.png
    output_dir/manifest.json           (metadata for everything extracted)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .docx_engine import DocxExtractor
from .models import ExtractionResult
from .pdf_engine import PdfExtractor


def run(input_path: Path, out_dir: Path) -> ExtractionResult:
    data = input_path.read_bytes()
    ext = input_path.suffix.lower()

    if ext == ".pdf":
        result = PdfExtractor().extract(data)
    elif ext in (".docx", ".doc"):
        result = DocxExtractor().extract(data)
    else:
        raise SystemExit(f"Unsupported file type: {ext}")

    tables_dir = out_dir / "tables"
    figures_dir = out_dir / "figures"
    tables_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"source": str(input_path), "tables": [], "figures": [], "warnings": result.warnings}

    for t in result.tables:
        png_path = tables_dir / f"{t.filename_stub}.png"
        csv_path = tables_dir / f"{t.filename_stub}.csv"
        png_path.write_bytes(t.image_bytes)
        csv_path.write_text(t.csv_text, encoding="utf-8")
        manifest["tables"].append(
            {
                "page": t.page_number,
                "bbox": t.bbox,
                "source": t.source,
                "caption": t.caption,
                "rows": int(t.dataframe.shape[0]),
                "cols": int(t.dataframe.shape[1]),
                "image": str(png_path.relative_to(out_dir)),
                "csv": str(csv_path.relative_to(out_dir)),
            }
        )

    for f in result.figures:
        png_path = figures_dir / f"{f.filename_stub}.png"
        png_path.write_bytes(f.image_bytes)
        manifest["figures"].append(
            {
                "page": f.page_number,
                "bbox": f.bbox,
                "source": f.source,
                "caption": f.caption,
                "width": f.width,
                "height": f.height,
                "image": str(png_path.relative_to(out_dir)),
            }
        )

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Extract tables and figures from a PDF or DOCX file.")
    parser.add_argument("input", type=Path, help="Path to a .pdf or .docx file")
    parser.add_argument("--out", type=Path, default=Path("extraction_output"), help="Output directory")
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        return 1

    result = run(args.input, args.out)
    print(f"Extracted {result.summary()} -> {args.out}")
    for w in result.warnings:
        print(f"  warning: {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
