#!/usr/bin/env python3
"""Build a compact Lv.1-Lv.4 Wangzai canonical comparison sheet."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
IMAGES = [
    ("Lv.1 Base", ROOT / "references" / "wangzai-lv1-canonical.png"),
    ("Lv.2 Explorer", ROOT / "canonical" / "wangzai-lv2-canonical.png"),
    ("Lv.3 Flight Engineer", ROOT / "canonical" / "wangzai-lv3-canonical.png"),
    ("Lv.4 Star Commander", ROOT / "canonical" / "wangzai-lv4-canonical.png"),
]
CELL_WIDTH = 320
CELL_HEIGHT = 360
LABEL_HEIGHT = 34
BACKGROUND = (244, 248, 252)


def main() -> None:
    sheet = Image.new("RGB", (CELL_WIDTH * len(IMAGES), CELL_HEIGHT + LABEL_HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, (label, path) in enumerate(IMAGES):
        image = Image.open(path).convert("RGB")
        image.thumbnail((CELL_WIDTH - 24, CELL_HEIGHT - 24), Image.Resampling.LANCZOS)
        x = index * CELL_WIDTH + (CELL_WIDTH - image.width) // 2
        y = LABEL_HEIGHT + (CELL_HEIGHT - image.height) // 2
        sheet.paste(image, (x, y))
        draw.text((index * CELL_WIDTH + 12, 10), label, fill=(25, 42, 60))
    output = ROOT / "qa" / "wangzai-level-canonical-sheet.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
