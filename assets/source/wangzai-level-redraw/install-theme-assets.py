#!/usr/bin/env python3
"""Install approved WangZai redraw APNGs into the theme asset directory."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
APNG_DIR = ROOT / "apng"
THEME_ASSETS = REPO / "themes" / "wangzai" / "assets"


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = bytearray(rgba.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index:index + 3] = b"\0\0\0"
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def mirror_apng(source: Path, destination: Path) -> None:
    image = Image.open(source)
    frames = []
    durations = []
    for index in range(getattr(image, "n_frames", 1)):
        image.seek(index)
        frames.append(clear_transparent_rgb(ImageOps.mirror(image.convert("RGBA"))))
        durations.append(image.info.get("duration", 120))
    frames[0].save(
        destination,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=image.info.get("loop", 0),
        disposal=1,
        blend=0,
        optimize=False,
    )


def copy_redraw(source_name: str, destination_name: str) -> None:
    source = APNG_DIR / source_name
    destination = THEME_ASSETS / destination_name
    if not source.is_file():
        raise SystemExit(f"missing redraw APNG: {source}")
    shutil.copy2(source, destination)
    print(f"wrote {destination}")


def main() -> None:
    THEME_ASSETS.mkdir(parents=True, exist_ok=True)
    for source in sorted(APNG_DIR.glob("wangzai-lv2-*-redraw.apng")):
        destination_name = source.name.replace("-redraw", "")
        copy_redraw(source.name, destination_name)

    mirror_apng(
        APNG_DIR / "wangzai-lv2-drag-right-redraw.apng",
        THEME_ASSETS / "wangzai-lv2-drag-left.apng",
    )
    print(f"wrote {THEME_ASSETS / 'wangzai-lv2-drag-left.apng'}")

    # These two key-state redraws come directly from the Lv.4 design sheet.
    copy_redraw("wangzai-lv4-working-redraw.apng", "wangzai-lv4-rocket-repair.apng")
    copy_redraw("wangzai-lv4-review-redraw.apng", "wangzai-lv4-review.apng")


if __name__ == "__main__":
    main()
