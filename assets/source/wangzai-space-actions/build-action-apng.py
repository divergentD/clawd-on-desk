#!/usr/bin/env python3
"""Convert a six-frame chroma-key pet strip into a transparent APNG."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


DEFAULT_EXTRACTOR = (
    Path.home() / ".codex" / "skills" / "hatch-pet" / "scripts" / "extract_strip_frames.py"
)


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
    parser.add_argument("--strip", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--duration", type=int, default=180)
    parser.add_argument("--chroma-key", default="#00FF00")
    parser.add_argument("--extractor", default=str(DEFAULT_EXTRACTOR))
    parser.add_argument("--frames-output")
    parser.add_argument(
        "--ping-pong",
        action="store_true",
        help="Append the interior frames in reverse order for a seamless return pose.",
    )
    args = parser.parse_args()

    strip = Path(args.strip).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    extractor = Path(args.extractor).expanduser().resolve()
    if not strip.is_file():
        raise SystemExit(f"missing strip: {strip}")
    if not extractor.is_file():
        raise SystemExit(f"missing hatch-pet extractor: {extractor}")

    with tempfile.TemporaryDirectory(prefix="clawd-action-apng-") as tmp:
        tmp_dir = Path(tmp)
        decoded_dir = tmp_dir / "decoded"
        frames_dir = tmp_dir / "frames"
        decoded_dir.mkdir()
        shutil.copy2(strip, decoded_dir / "idle.png")
        subprocess.run(
            [
                sys.executable,
                str(extractor),
                "--decoded-dir",
                str(decoded_dir),
                "--output-dir",
                str(frames_dir),
                "--states",
                "idle",
                "--chroma-key",
                args.chroma_key,
                "--method",
                "stable-slots",
            ],
            check=True,
        )

        frame_paths = sorted((frames_dir / "idle").glob("*.png"))
        if len(frame_paths) != 6:
            raise SystemExit(f"expected 6 extracted frames, got {len(frame_paths)}")
        frames = [clear_transparent_rgb(Image.open(path)) for path in frame_paths]
        if args.ping_pong and len(frames) > 2:
            frames = frames + frames[-2:0:-1]

        output.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            output,
            format="PNG",
            save_all=True,
            append_images=frames[1:],
            duration=args.duration,
            loop=0,
            disposal=1,
            blend=0,
            optimize=False,
        )

        if args.frames_output:
            frames_output = Path(args.frames_output).expanduser().resolve()
            frames_output.mkdir(parents=True, exist_ok=True)
            for index, frame in enumerate(frames):
                frame.save(frames_output / f"{index:02d}.png")

    print(f"wrote {output}")


if __name__ == "__main__":
    main()
