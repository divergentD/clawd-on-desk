#!/usr/bin/env python3
"""Build Wangzai Lv.3-Lv.4 APNG skins from the approved Lv.2 redraw set.

Lv.2 is installed directly from the image-generation redraw APNGs under
`assets/source/wangzai-level-redraw/apng/`. This script keeps that body, scale,
silhouette, and animation timing intact while adding only Lv.3/Lv.4 suit
surfaces, holographic work tools, and the Lv.4 assistant orb.
"""

from __future__ import annotations

import argparse
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


LEVELS = (3, 4)
ACTIVE_ORB_ASSETS = {
    "idle-natural",
    "happy",
    "review",
    "rocket-repair",
    "mission-control",
    "robotic-arms",
    "rover-welding",
    "sample-vacuum",
    "carrying-module",
    "waiting",
    "mini-idle",
    "mini-alert",
    "mini-happy",
    "mini-peek",
}

SUIT_PALETTES = {
    2: {
        "soft_tint": (198, 234, 246),
        "panel": (58, 190, 228, 235),
        "panel_dark": (21, 110, 172, 235),
        "accent": (255, 184, 72, 255),
        "glow": (78, 240, 255, 240),
    },
    3: {
        "soft_tint": (206, 238, 255),
        "panel": (80, 188, 235, 238),
        "panel_dark": (36, 132, 206, 238),
        "accent": (255, 196, 82, 255),
        "glow": (72, 238, 255, 245),
    },
    4: {
        "soft_tint": (218, 246, 255),
        "panel": (76, 204, 238, 238),
        "panel_dark": (30, 150, 218, 238),
        "accent": (255, 205, 78, 255),
        "glow": (88, 250, 255, 248),
    },
}


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = bytearray(rgba.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index:index + 3] = b"\0\0\0"
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def connected_components(mask: list[list[bool]]) -> list[tuple[int, int, int, int, int]]:
    height = len(mask)
    width = len(mask[0])
    seen = [[False] * width for _ in range(height)]
    components = []
    for y in range(height):
        for x in range(width):
            if seen[y][x] or not mask[y][x]:
                continue
            seen[y][x] = True
            queue = deque([(x, y)])
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while queue:
                px, py = queue.popleft()
                count += 1
                min_x, max_x = min(min_x, px), max(max_x, px)
                min_y, max_y = min(min_y, py), max(max_y, py)
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and mask[ny][nx]:
                        seen[ny][nx] = True
                        queue.append((nx, ny))
            components.append((min_x, min_y, max_x + 1, max_y + 1, count))
    return components


def find_visor(frame: Image.Image) -> tuple[int, int, int, int]:
    rgba = frame.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    mask = []
    for y in range(height):
        row = []
        for x in range(width):
            r, g, b, a = pixels[x, y]
            row.append(a > 96 and r < 65 and g < 80 and b < 92)
        mask.append(row)

    candidates = []
    for x0, y0, x1, y1, count in connected_components(mask):
        w, h = x1 - x0, y1 - y0
        aspect = w / max(h, 1)
        # Side-on mini-crabwalk frames have a narrow visor (aspect ~= 0.9).
        if w >= 12 and h >= 7 and 0.72 <= aspect <= 3.8:
            center_bias = max(0.25, 1 - abs((x0 + x1) / 2 - width / 2) / width)
            top_bias = max(0.35, 1 - y0 / height)
            candidates.append((count * aspect * center_bias * top_bias, (x0, y0, x1, y1)))
    if not candidates:
        raise RuntimeError("could not locate Wangzai visor")
    return max(candidates)[1]


def blend_channel(source: int, target: int, amount: float) -> int:
    return round(source * (1 - amount) + target * amount)


def tint_suit(frame: Image.Image, visor: tuple[int, int, int, int], level: int) -> Image.Image:
    if level <= 1:
        return frame
    rgba = frame.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    x0, y0, x1, y1 = visor
    center_x = (x0 + x1) // 2
    visor_width = x1 - x0
    radius_x = max(38, round(visor_width * 1.08))
    region_top = max(0, y0 - 22)
    region_bottom = min(height, y1 + 118)
    palettes = {
        2: (SUIT_PALETTES[2]["soft_tint"], 0.18),
        3: (SUIT_PALETTES[3]["soft_tint"], 0.10),
        4: (SUIT_PALETTES[4]["soft_tint"], 0.12),
    }
    target, amount = palettes[level]
    for y in range(region_top, region_bottom):
        for x in range(max(0, center_x - radius_x), min(width, center_x + radius_x + 1)):
            r, g, b, a = pixels[x, y]
            if a < 24:
                continue
            # Lightly cool only neutral suit pixels; the visible level change is
            # drawn as suit surface panels below, not a full-body repaint.
            if max(r, g, b) - min(r, g, b) > 28 or max(r, g, b) < 72:
                continue
            luminance = (r + g + b) / 3
            shade = max(0.42, min(1.18, luminance / 210))
            shaded_target = tuple(min(255, round(channel * shade)) for channel in target)
            pixels[x, y] = (
                blend_channel(r, shaded_target[0], amount),
                blend_channel(g, shaded_target[1], amount),
                blend_channel(b, shaded_target[2], amount),
                a,
            )
    return rgba


def draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    radius: int = 4,
    width: int = 1,
) -> None:
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    except AttributeError:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def draw_suit_panels(
    draw: ImageDraw.ImageDraw,
    visor: tuple[int, int, int, int],
    frame_size: tuple[int, int],
    level: int,
    frame_index: int,
) -> None:
    x0, y0, x1, y1 = visor
    width, height = frame_size
    palette = SUIT_PALETTES[level]
    cx = (x0 + x1) // 2
    visor_w = x1 - x0
    body_top = y1 + max(7, visor_w // 12)
    chest_w = max(22, min(46, visor_w - 8))
    chest_h = max(13, min(28, visor_w // 3))
    chest_y = min(height - 36, body_top + 9)
    pulse = frame_index % 6

    # Chest control plate: the clearest suit-level read at pet size.
    if level == 2:
        draw_rounded_rect(
            draw,
            (cx - chest_w // 2, chest_y, cx + chest_w // 2, chest_y + chest_h),
            palette["panel"],
            (245, 255, 255, 230),
            radius=5,
            width=1,
        )
        draw_rounded_rect(
            draw,
            (cx - 8, chest_y + 4, cx + 8, chest_y + 8),
            palette["glow"],
            None,
            radius=3,
        )
    elif level == 3:
        draw.polygon(
            [
                (cx - chest_w // 2 - 2, chest_y + 2),
                (cx - chest_w // 3, chest_y - 3),
                (cx + chest_w // 3, chest_y - 3),
                (cx + chest_w // 2 + 2, chest_y + 2),
                (cx + chest_w // 2 - 3, chest_y + chest_h + 2),
                (cx - chest_w // 2 + 3, chest_y + chest_h + 2),
            ],
            fill=palette["panel"],
            outline=(245, 255, 255, 220),
        )
        draw.line((cx - chest_w // 3, chest_y + 5, cx + chest_w // 3, chest_y + 5), fill=palette["glow"], width=2)
        draw.line((cx, chest_y - 1, cx, chest_y + chest_h + 1), fill=palette["panel_dark"], width=2)
    else:
        draw.polygon(
            [
                (cx, chest_y - 5),
                (cx + chest_w // 2 + 5, chest_y + 4),
                (cx + chest_w // 3, chest_y + chest_h + 4),
                (cx, chest_y + chest_h + 8),
                (cx - chest_w // 3, chest_y + chest_h + 4),
                (cx - chest_w // 2 - 5, chest_y + 4),
            ],
            fill=palette["panel"],
            outline=palette["accent"],
        )
        draw.polygon(
            [(cx, chest_y - 1), (cx + 7, chest_y + 8), (cx, chest_y + 16), (cx - 7, chest_y + 8)],
            fill=palette["accent"],
        )
        scan = chest_y + 3 + pulse
        draw.line((cx - chest_w // 3, scan, cx + chest_w // 3, scan), fill=palette["glow"], width=1)

    # Helmet stripes and shoulder/sleeve cuffs stay attached to the existing body.
    stripe_y = max(2, y0 - 5)
    stripe_len = max(10, visor_w // 6)
    for offset in (-max(12, visor_w // 4), max(12, visor_w // 4)):
        draw.line((cx + offset - stripe_len // 2, stripe_y, cx + offset + stripe_len // 2, stripe_y + 3), fill=palette["panel"], width=3)

    cuff_y = min(height - 22, y1 + max(22, visor_w // 2))
    for side in (-1, 1):
        sx = cx + side * max(24, visor_w // 2)
        if 5 <= sx < width - 5:
            draw.line((sx - side * 5, cuff_y, sx + side * 9, cuff_y + 2), fill=palette["panel_dark"], width=3)
            draw.point((sx + side * 10, cuff_y + 2), fill=palette["glow"])

    boot_y = min(height - 12, y1 + max(58, round(visor_w * 0.9)))
    if boot_y > y1 + 18:
        draw.line((cx - 26, boot_y, cx - 11, boot_y), fill=palette["panel"], width=3)
        draw.line((cx + 11, boot_y, cx + 26, boot_y), fill=palette["panel"], width=3)

    if level >= 3:
        # Attached micro-thruster inlays, not detached effects.
        draw.line((cx - 12, chest_y + chest_h + 5, cx - 18, chest_y + chest_h + 13), fill=palette["panel_dark"], width=2)
        draw.line((cx + 12, chest_y + chest_h + 5, cx + 18, chest_y + chest_h + 13), fill=palette["panel_dark"], width=2)
        if pulse in (1, 2, 3):
            draw.point((cx - 19, chest_y + chest_h + 14), fill=palette["glow"])
            draw.point((cx + 19, chest_y + chest_h + 14), fill=palette["glow"])


def draw_holographic_review(
    draw: ImageDraw.ImageDraw,
    visor: tuple[int, int, int, int],
    level: int,
    frame_index: int,
) -> None:
    if level < 3:
        return
    x0, _, x1, y1 = visor
    center_x = (x0 + x1) // 2
    panel_y = y1 + 8
    cyan = (55, 235, 255, 210)
    blue = (24, 126, 218, 96)
    gold = (255, 202, 72, 230)
    width = 24 if level == 3 else 34
    height = 16 if level == 3 else 24
    draw.polygon(
        [
            (center_x - width, panel_y + height),
            (center_x - width + 5, panel_y),
            (center_x + width - 5, panel_y),
            (center_x + width, panel_y + height),
        ],
        fill=blue,
        outline=cyan,
    )
    scan_y = panel_y + 4 + (frame_index * 4) % max(5, height - 3)
    draw.line((center_x - width + 5, scan_y, center_x + width - 5, scan_y), fill=cyan, width=1)
    draw.line((center_x, panel_y + height, center_x, panel_y + height + 5), fill=gold, width=2)


def draw_assistant_orb(
    draw: ImageDraw.ImageDraw,
    visor: tuple[int, int, int, int],
    frame_size: tuple[int, int],
    asset: str,
    level: int,
    frame_index: int,
) -> None:
    if level < 4 or asset not in ACTIVE_ORB_ASSETS:
        return
    x0, y0, x1, _ = visor
    width, _ = frame_size
    phase = frame_index * math.pi / 3
    use_right = x1 + 26 < width
    orbit_x = x1 + 16 if use_right else x0 - 16
    orb_x = round(orbit_x + math.cos(phase) * 4)
    orb_y = round(max(10, y0 - 8) + math.sin(phase) * 5)
    cyan = (68, 241, 255, 255)
    pale = (196, 255, 255, 255)
    navy = (18, 80, 150, 255)
    gold = (255, 194, 62, 255)
    draw.ellipse((orb_x - 7, orb_y - 7, orb_x + 7, orb_y + 7), fill=navy, outline=gold, width=2)
    draw.ellipse((orb_x - 4, orb_y - 4, orb_x + 4, orb_y + 4), fill=cyan)
    draw.ellipse((orb_x - 2, orb_y - 3, orb_x + 1, orb_y), fill=pale)
    draw.line((orb_x - 9, orb_y, orb_x - 11, orb_y), fill=cyan, width=1)
    draw.line((orb_x + 9, orb_y, orb_x + 11, orb_y), fill=cyan, width=1)


def draw_ornament(frame: Image.Image, level: int, asset: str, frame_index: int) -> Image.Image:
    rgba = frame.convert("RGBA")
    visor = find_visor(rgba)
    rgba = tint_suit(rgba, visor, level)
    x0, y0, x1, y1 = visor
    draw = ImageDraw.Draw(rgba)
    center_x = (x0 + x1) // 2
    badge_y = max(5, y0 - 3)
    gold = (246, 178, 52, 255)
    gold_hi = (255, 221, 115, 255)
    cyan = (35, 225, 242, 255)
    navy = (25, 83, 121, 255)

    draw_suit_panels(draw, visor, rgba.size, level, frame_index)

    # Lv.2: compact mission badge mounted directly on the helmet brow.
    draw.line((center_x, badge_y + 4, center_x, y0 + 1), fill=gold, width=2)
    draw.polygon(
        [(center_x, badge_y - 3), (center_x + 4, badge_y), (center_x, badge_y + 4), (center_x - 4, badge_y)],
        fill=gold,
    )
    draw.rectangle((center_x - 1, badge_y - 1, center_x + 1, badge_y + 1), fill=cyan)

    if level >= 3:
        # Lv.3: flight-engineer side fins, attached to the visor rim.
        fin_y = y0 + max(3, (y1 - y0) // 3)
        draw.polygon([(x0, fin_y - 3), (x0 - 6, fin_y), (x0, fin_y + 4)], fill=navy)
        draw.polygon([(x1 - 1, fin_y - 3), (x1 + 5, fin_y), (x1 - 1, fin_y + 4)], fill=navy)
        draw.line((x0 - 3, fin_y, x0 + 1, fin_y), fill=gold_hi, width=2)
        draw.line((x1 - 2, fin_y, x1 + 2, fin_y), fill=gold_hi, width=2)
        draw.point((x0 - 3, fin_y), fill=cyan)
        draw.point((x1 + 2, fin_y), fill=cyan)
        pulse = 1 + frame_index % 3
        draw.line((x0 + 4, y1 + 5, x0 + 4 + pulse, y1 + 8), fill=cyan, width=2)
        draw.line((x1 - 5, y1 + 5, x1 - 5 - pulse, y1 + 8), fill=cyan, width=2)

    if level >= 4:
        # Lv.4: a three-ray command crest, still physically connected to Lv.2's badge.
        crest_base = badge_y - 2
        draw.line((center_x, crest_base, center_x, max(1, crest_base - 9)), fill=gold_hi, width=2)
        draw.line((center_x - 1, crest_base, center_x - 6, max(2, crest_base - 6)), fill=gold, width=2)
        draw.line((center_x + 1, crest_base, center_x + 6, max(2, crest_base - 6)), fill=gold, width=2)
        draw.point((center_x, max(1, crest_base - 10)), fill=cyan)
        draw.point((center_x - 7, max(2, crest_base - 7)), fill=cyan)
        draw.point((center_x + 7, max(2, crest_base - 7)), fill=cyan)
        draw.arc((x0 - 3, y0 - 3, x1 + 3, y1 + 3), 202, 338, fill=gold_hi, width=2)

    if asset == "review":
        draw_holographic_review(draw, visor, level, frame_index)
    draw_assistant_orb(draw, visor, rgba.size, asset, level, frame_index)
    return clear_transparent_rgb(rgba)


def build_apng(source: Path, destination: Path, level: int, asset: str) -> None:
    image = Image.open(source)
    frames = []
    durations = []
    for index in range(getattr(image, "n_frames", 1)):
        image.seek(index)
        frames.append(draw_ornament(image.convert("RGBA"), level, asset, index))
        durations.append(image.info.get("duration", 180))
    destination.parent.mkdir(parents=True, exist_ok=True)
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", default="themes/wangzai/assets")
    args = parser.parse_args()
    assets_dir = Path(args.assets_dir).expanduser().resolve()
    sources = sorted(assets_dir.glob("wangzai-lv2-*.apng"))
    if not sources:
        raise SystemExit(f"no Wangzai Lv.2 redraw APNG files found under {assets_dir}")
    for level in LEVELS:
        for source in sources:
            suffix = source.name.removeprefix("wangzai-lv2-")
            asset = suffix.removesuffix(".apng")
            destination = assets_dir / f"wangzai-lv{level}-{suffix}"
            build_apng(source, destination, level, asset)
            print(f"wrote {destination}")


if __name__ == "__main__":
    main()
