#!/usr/bin/env python3
"""Render a first-frame comparison sheet for the Wangzai level skins."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


ASSETS = [
    "idle-natural", "review", "rocket-repair", "mission-control",
    "robotic-arms", "rover-welding", "sample-vacuum", "carrying-module",
    "waiting", "failed", "drag-left", "drag-right", "poke", "wave",
    "sleeping", "mini-idle", "mini-alert", "mini-sleep",
]
LEVELS = ("lv1", "lv2", "lv3", "lv4")
CELL_WIDTH = 192
CELL_HEIGHT = 208
LABEL_HEIGHT = 24


def asset_path(assets_dir: Path, level: str, asset: str) -> Path:
    prefix = "wangzai-" if level == "lv1" else f"wangzai-{level}-"
    return assets_dir / f"{prefix}{asset}.apng"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", default="themes/wangzai/assets")
    parser.add_argument(
        "--output",
        default="assets/source/wangzai-level-skins/qa/wangzai-levels-contact-sheet.png",
    )
    args = parser.parse_args()
    assets_dir = Path(args.assets_dir).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    sheet = Image.new("RGBA", (CELL_WIDTH * len(LEVELS), (CELL_HEIGHT + LABEL_HEIGHT) * len(ASSETS)), "white")
    draw = ImageDraw.Draw(sheet)
    for row, asset in enumerate(ASSETS):
        for column, level in enumerate(LEVELS):
            source = asset_path(assets_dir, level, asset)
            frame = Image.open(source).convert("RGBA")
            x = column * CELL_WIDTH
            y = row * (CELL_HEIGHT + LABEL_HEIGHT)
            sheet.alpha_composite(frame, (x, y + LABEL_HEIGHT))
            draw.text((x + 4, y + 4), f"{level} {asset}", fill=(25, 35, 50, 255))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
