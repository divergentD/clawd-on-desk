#!/usr/bin/env python3
"""Render representative Wangzai level APNG frames for motion QA."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


ASSETS = ["idle-natural", "review", "rocket-repair", "drag-left", "sleeping", "mini-crabwalk"]
LEVELS = ("lv2", "lv3", "lv4")
CELL_WIDTH = 192
CELL_HEIGHT = 208
LABEL_HEIGHT = 24


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", default="themes/wangzai/assets")
    parser.add_argument(
        "--output",
        default="assets/source/wangzai-level-skins/qa/wangzai-levels-motion-sheet.png",
    )
    args = parser.parse_args()
    assets_dir = Path(args.assets_dir).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    rows = []
    max_frames = 0
    for asset in ASSETS:
        for level in LEVELS:
            image = Image.open(assets_dir / f"wangzai-{level}-{asset}.apng")
            frames = []
            for index in range(getattr(image, "n_frames", 1)):
                image.seek(index)
                frames.append(image.convert("RGBA"))
            rows.append((f"{level} {asset}", frames))
            max_frames = max(max_frames, len(frames))

    sheet = Image.new("RGBA", (CELL_WIDTH * max_frames, (CELL_HEIGHT + LABEL_HEIGHT) * len(rows)), "white")
    draw = ImageDraw.Draw(sheet)
    for row, (label, frames) in enumerate(rows):
        y = row * (CELL_HEIGHT + LABEL_HEIGHT)
        draw.text((4, y + 4), label, fill=(25, 35, 50, 255))
        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * CELL_WIDTH, y + LABEL_HEIGHT))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
