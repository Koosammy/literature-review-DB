"""Restore the vertical stage labels in a rendered Word PRISMA diagram."""

import re

import pymupdf as fitz
from lxml import etree

_STAGES = ("Identification", "Screening", "Included")
_SVG_USE = "{http://www.w3.org/2000/svg}use"


def repair_stage_labels(page: fitz.Page, diagram: fitz.Rect) -> bytes | None:
    """Return SVG with misplaced glyphs rotated into the left-hand bars.

    LibreOffice can place a rotated Word shape's text horizontally over the
    record boxes. Move the original glyphs so the underlying text is preserved.
    Require the standard three bars and match each glyph before making changes.
    """
    bars = []
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if (drawing.get("fill") and diagram.contains(rect)
                and rect.x1 <= diagram.x0 + diagram.width * 0.2
                and 8 <= rect.width <= 45 and rect.height >= 2 * rect.width):
            bars.append(rect)
    bars.sort(key=lambda rect: rect.y0)
    if len(bars) != len(_STAGES) or any(
        upper.y1 > lower.y0 or abs(upper.x0 - lower.x0) > 4
        for upper, lower in zip(bars, bars[1:])
    ):
        return None

    spans = page.get_texttrace()
    misplaced = []
    for stage, bar in zip(_STAGES, bars):
        codes = tuple(map(ord, stage))
        matches = [
            span for span in spans
            if tuple(char[0] for char in span["chars"]) == codes
            and diagram.contains(fitz.Rect(span["bbox"]))
            and bar.y0 <= fitz.Rect(span["bbox"]).y0 <= bar.y1
        ]
        if len(matches) != 1:
            return None
        span = matches[0]
        original = fitz.Rect(span["bbox"])
        if not bar.contains(original) and span["dir"] == (1.0, 0.0):
            if original.width > bar.height - 4 or original.height > bar.width - 4:
                return None
            misplaced.append((bar, original, span["chars"]))
    if not misplaced:
        return None

    svg = etree.fromstring(page.get_svg_image(text_as_path=True).encode())
    glyphs = {}
    for glyph in svg.iter(_SVG_USE):
        transform = re.fullmatch(r"matrix\(([^)]+)\)", glyph.get("transform", ""))
        if not transform:
            continue
        values = re.split(r"[,\s]+", transform[1].strip())
        if len(values) == 6:
            x, y = map(float, values[-2:])
            glyphs.setdefault(glyph.get("data-text"), []).append((glyph, x, y))

    for bar, original, chars in misplaced:
        target = (bar.tl + bar.br) / 2
        center = (original.tl + original.br) / 2
        rotation = f"translate({target.x},{target.y}) rotate(-90) translate({-center.x},{-center.y})"
        for code, _, (x, y), _ in chars:
            matches = [
                glyph for glyph, gx, gy in glyphs.get(chr(code), ())
                if abs(gx - x) < 0.1 and abs(gy - y) < 0.1
            ]
            if len(matches) != 1 or any(
                parent.get("clip-path") or parent.get("transform")
                for parent in matches[0].iterancestors()
            ):
                return None
            glyph = matches[0]
            glyph.set("transform", f"{rotation} {glyph.get('transform')}")

    return etree.tostring(svg)
