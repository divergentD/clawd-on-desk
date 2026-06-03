#!/usr/bin/env python3
"""Convert approved WangZai level redraw strips into transparent APNG previews."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
CELL_SIZE = (192, 208)
CHROMA_KEY = (255, 0, 255)
CHROMA_TOLERANCE = 46
MIN_COMPONENT_AREA = 120


@dataclass(frozen=True)
class StripJob:
    strip_name: str
    output_name: str
    frame_count: int
    duration: int = 180


@dataclass(frozen=True)
class Component:
    box: tuple[int, int, int, int]
    area: int
    pixels: tuple[tuple[int, int], ...]

    @property
    def center_x(self) -> float:
        x0, _, x1, _ = self.box
        return (x0 + x1) / 2

    @property
    def width(self) -> int:
        x0, _, x1, _ = self.box
        return x1 - x0

    @property
    def height(self) -> int:
        _, y0, _, y1 = self.box
        return y1 - y0


JOBS = (
    StripJob("wangzai-lv2-idle-natural-strip.png", "wangzai-lv2-idle-natural-redraw.apng", 6, 240),
    StripJob("wangzai-lv2-yawning-strip.png", "wangzai-lv2-yawning-redraw.apng", 6, 520),
    StripJob("wangzai-lv2-dozing-strip.png", "wangzai-lv2-dozing-redraw.apng", 6, 600),
    StripJob("wangzai-lv2-collapsing-strip.png", "wangzai-lv2-collapsing-redraw.apng", 6, 450),
    StripJob("wangzai-lv2-review-strip.png", "wangzai-lv2-review-redraw.apng", 6, 150),
    StripJob("wangzai-lv2-rocket-repair-strip.png", "wangzai-lv2-rocket-repair-redraw.apng", 6, 120),
    StripJob("wangzai-lv2-rover-welding-strip.png", "wangzai-lv2-rover-welding-redraw.apng", 6, 190),
    StripJob("wangzai-lv2-mission-control-strip.png", "wangzai-lv2-mission-control-redraw.apng", 6, 200),
    StripJob("wangzai-lv2-robotic-arms-strip.png", "wangzai-lv2-robotic-arms-redraw.apng", 6, 190),
    StripJob("wangzai-lv2-sample-vacuum-strip.png", "wangzai-lv2-sample-vacuum-redraw.apng", 6, 200),
    StripJob("wangzai-lv2-carrying-module-strip.png", "wangzai-lv2-carrying-module-redraw.apng", 6, 210),
    StripJob("wangzai-lv2-happy-strip.png", "wangzai-lv2-happy-redraw.apng", 6, 140),
    StripJob("wangzai-lv2-failed-strip.png", "wangzai-lv2-failed-redraw.apng", 6, 140),
    StripJob("wangzai-lv2-poke-strip.png", "wangzai-lv2-poke-redraw.apng", 5, 140),
    StripJob("wangzai-lv2-wave-strip.png", "wangzai-lv2-wave-redraw.apng", 4, 140),
    StripJob("wangzai-lv2-drag-right-strip.png", "wangzai-lv2-drag-right-redraw.apng", 8, 120),
    StripJob("wangzai-lv2-mini-idle-strip.png", "wangzai-lv2-mini-idle-redraw.apng", 10, 520),
    StripJob("wangzai-lv2-mini-alert-strip.png", "wangzai-lv2-mini-alert-redraw.apng", 10, 240),
    StripJob("wangzai-lv2-mini-happy-strip.png", "wangzai-lv2-mini-happy-redraw.apng", 10, 240),
    StripJob("wangzai-lv2-mini-enter-strip.png", "wangzai-lv2-mini-enter-redraw.apng", 6, 180),
    StripJob("wangzai-lv2-mini-peek-strip.png", "wangzai-lv2-mini-peek-redraw.apng", 10, 280),
    StripJob("wangzai-lv2-mini-crabwalk-strip.png", "wangzai-lv2-mini-crabwalk-redraw.apng", 10, 180),
    StripJob("wangzai-lv2-mini-enter-sleep-strip.png", "wangzai-lv2-mini-enter-sleep-redraw.apng", 6, 260),
    StripJob("wangzai-lv2-mini-sleep-strip.png", "wangzai-lv2-mini-sleep-redraw.apng", 10, 700),
    StripJob("wangzai-lv2-waiting-strip.png", "wangzai-lv2-waiting-redraw.apng", 6, 150),
    StripJob("wangzai-lv2-sleeping-strip.png", "wangzai-lv2-sleeping-redraw.apng", 6, 700),
    StripJob("wangzai-lv2-waking-strip.png", "wangzai-lv2-waking-redraw.apng", 6, 350),
    StripJob("wangzai-lv4-working-strip.png", "wangzai-lv4-working-redraw.apng", 6, 180),
    StripJob("wangzai-lv4-review-strip.png", "wangzai-lv4-review-redraw.apng", 6, 200),
)


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = bytearray(rgba.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index:index + 3] = b"\0\0\0"
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def remove_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    kr, kg, kb = CHROMA_KEY
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            distance = abs(r - kr) + abs(g - kg) + abs(b - kb)
            magenta_dominant = r > 180 and b > 180 and g < 90
            if distance <= CHROMA_TOLERANCE or magenta_dominant:
                pixels[x, y] = (0, 0, 0, 0)
    return clear_transparent_rgb(rgba)


def normalize_purple_to_cyan(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            # Generation often leaves purple hologram remnants. Keep the effect,
            # but make it part of the allowed cyan control language.
            if r > 115 and b > 145 and g < 155:
                intensity = max(r, b)
                pixels[x, y] = (
                    min(120, max(40, g)),
                    min(255, max(185, intensity)),
                    255,
                    a,
                )
    return clear_transparent_rgb(rgba)


def alpha_components(image: Image.Image) -> list[Component]:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    seen = [[False] * width for _ in range(height)]
    components = []
    for y in range(height):
        for x in range(width):
            if seen[y][x] or pixels[x, y][3] == 0:
                continue
            stack = [(x, y)]
            seen[y][x] = True
            component_pixels = []
            min_x = max_x = x
            min_y = max_y = y
            while stack:
                px, py = stack.pop()
                component_pixels.append((px, py))
                min_x = min(min_x, px)
                max_x = max(max_x, px)
                min_y = min(min_y, py)
                max_y = max(max_y, py)
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and pixels[nx, ny][3] > 0:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            components.append(Component(
                box=(min_x, min_y, max_x + 1, max_y + 1),
                area=len(component_pixels),
                pixels=tuple(component_pixels),
            ))
    return components


def is_artifact_component(component: Component) -> bool:
    if component.area < MIN_COMPONENT_AREA:
        return True
    return component.area < 900 and component.width <= 18


def remove_artifact_components(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for component in alpha_components(rgba):
        if is_artifact_component(component):
            for px, py in component.pixels:
                pixels[px, py] = (0, 0, 0, 0)
    return clear_transparent_rgb(rgba)


def split_strip_by_components(strip: Image.Image, frame_count: int) -> list[Image.Image]:
    cleaned = remove_artifact_components(remove_chroma(strip))
    components = [
        component
        for component in alpha_components(cleaned)
        if not is_artifact_component(component)
    ]
    anchors = sorted(
        sorted(components, key=lambda component: component.area, reverse=True)[:frame_count],
        key=lambda component: component.center_x,
    )
    if len(anchors) != frame_count:
        raise SystemExit(f"expected {frame_count} frame anchors, got {len(anchors)}")

    boundaries = [-1.0]
    for left, right in zip(anchors, anchors[1:]):
        boundaries.append((left.center_x + right.center_x) / 2)
    boundaries.append(float(cleaned.width + 1))

    frames = []
    for index in range(frame_count):
        left_bound = boundaries[index]
        right_bound = boundaries[index + 1]
        group = [
            component
            for component in components
            if left_bound < component.center_x <= right_bound
        ]
        if not group:
            raise SystemExit(f"no components found for frame {index}")
        x0 = min(component.box[0] for component in group)
        y0 = min(component.box[1] for component in group)
        x1 = max(component.box[2] for component in group)
        y1 = max(component.box[3] for component in group)
        frame = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        frame_pixels = frame.load()
        source_pixels = cleaned.load()
        for component in group:
            for px, py in component.pixels:
                frame_pixels[px - x0, py - y0] = source_pixels[px, py]
        frames.append(clear_transparent_rgb(frame))
    return frames


def remove_small_components(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for component in alpha_components(rgba):
        if component.area < MIN_COMPONENT_AREA:
            for px, py in component.pixels:
                    pixels[px, py] = (0, 0, 0, 0)
    return clear_transparent_rgb(rgba)


def split_strip(strip: Image.Image, frame_count: int) -> list[Image.Image]:
    width, height = strip.size
    frames = []
    for index in range(frame_count):
        left = round(index * width / frame_count)
        right = round((index + 1) * width / frame_count)
        frames.append(strip.crop((left, 0, right, height)))
    return frames


def fit_frames(frames: list[Image.Image]) -> list[Image.Image]:
    cleaned = [remove_small_components(remove_chroma(frame)) for frame in frames]
    boxes = [frame.getbbox() for frame in cleaned]
    if any(box is None for box in boxes):
        raise SystemExit("strip contains an empty frame after chroma removal")

    max_w = max(box[2] - box[0] for box in boxes if box is not None)
    max_h = max(box[3] - box[1] for box in boxes if box is not None)
    target_w, target_h = CELL_SIZE
    scale = min((target_w - 12) / max_w, (target_h - 10) / max_h)
    scale = min(scale, 1.0)

    out = []
    for frame, box in zip(cleaned, boxes):
        assert box is not None
        crop = frame.crop(box)
        new_size = (
            max(1, round(crop.width * scale)),
            max(1, round(crop.height * scale)),
        )
        crop = crop.resize(new_size, Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", CELL_SIZE, (0, 0, 0, 0))
        x = (target_w - crop.width) // 2
        y = target_h - crop.height - 4
        cell.alpha_composite(crop, (x, y))
        out.append(normalize_purple_to_cyan(clear_transparent_rgb(cell)))
    return out


def save_apng(frames: list[Image.Image], output: Path, duration: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        disposal=1,
        blend=0,
        optimize=False,
    )


def make_contact_sheet(rows: list[tuple[str, list[Image.Image]]], output: Path) -> None:
    label_h = 24
    cell_w, cell_h = CELL_SIZE
    max_frames = max(len(frames) for _, frames in rows)
    sheet = Image.new("RGBA", (cell_w * max_frames, (cell_h + label_h) * len(rows)), "white")
    draw = ImageDraw.Draw(sheet)
    for row_index, (label, frames) in enumerate(rows):
        y = row_index * (cell_h + label_h)
        draw.text((8, y + 5), label, fill=(25, 42, 60))
        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * cell_w, y + label_h))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)


def main() -> None:
    rows = []
    for job in JOBS:
        strip_path = ROOT / "strips" / job.strip_name
        if not strip_path.is_file():
            raise SystemExit(f"missing strip: {strip_path}")
        strip = Image.open(strip_path).convert("RGBA")
        frames = fit_frames(split_strip_by_components(strip, job.frame_count))
        save_apng(frames, ROOT / "apng" / job.output_name, job.duration)
        rows.append((job.output_name, frames))
    make_contact_sheet(rows, ROOT / "qa" / "wangzai-level-redraw-contact-sheet.png")
    print(f"wrote {len(JOBS)} APNG previews and QA contact sheet")


if __name__ == "__main__":
    main()
