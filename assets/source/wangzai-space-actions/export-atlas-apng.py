#!/usr/bin/env python3
"""Export Wangzai Codex Pet atlas rows as transparent APNG files."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_WIDTH = 192
FRAME_HEIGHT = 208
ROWS = {
    "idle": (0, [280, 110, 110, 140, 140, 320]),
    "running-right": (1, [120, 120, 120, 120, 120, 120, 120, 220]),
    "running-left": (2, [120, 120, 120, 120, 120, 120, 120, 220]),
    "waving": (3, [140, 140, 140, 280]),
    "jumping": (4, [140, 140, 140, 140, 280]),
    "failed": (5, [140, 140, 140, 140, 140, 140, 140, 240]),
    "waiting": (6, [150, 150, 150, 150, 150, 260]),
    "running": (7, [120, 120, 120, 120, 120, 220]),
    "review": (8, [150, 150, 150, 150, 150, 280]),
}


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = bytearray(rgba.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index] = 0
            data[index + 1] = 0
            data[index + 2] = 0
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--row", choices=sorted(ROWS), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--ping-pong",
        action="store_true",
        help="Append interior frames in reverse order for a seamless loop.",
    )
    args = parser.parse_args()

    atlas = Image.open(Path(args.atlas).expanduser().resolve()).convert("RGBA")
    row_index, durations = ROWS[args.row]
    frames = []
    for column in range(len(durations)):
        box = (
            column * FRAME_WIDTH,
            row_index * FRAME_HEIGHT,
            (column + 1) * FRAME_WIDTH,
            (row_index + 1) * FRAME_HEIGHT,
        )
        frames.append(clear_transparent_rgb(atlas.crop(box)))

    if args.ping_pong and len(frames) > 2:
        frames = frames + frames[-2:0:-1]
        durations = durations + durations[-2:0:-1]

    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=1,
        blend=0,
        optimize=False,
    )
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
