# Wangzai Level Redraw

This folder contains the grounded image-generation workflow for Wangzai Lv.2
through Lv.4. The original Lv.1 canonical image remains the identity reference.

## Visual Bible

All levels keep Wangzai's rounded astronaut-robot body, black glass face screen,
two cyan rounded-square eyes, short limbs, friendly proportions, antenna, and
clean stylized 3D-toy rendering. Body size, head/body ratio, limb length,
helmet size, stance width, and overall silhouette must match Lv.1; only the
astronaut suit surface design may evolve.

| Level | Art direction |
| --- | --- |
| Lv.2 | Explorer suit skin: same body, pearl-white base, sky-blue suit panels, orange piping, small mission badge |
| Lv.3 | Flight engineer suit skin: same body, pearl-white base, brighter sapphire paneling, cyan energy accents, compact engineer markings |
| Lv.4 | Star commander suit skin: same body, luminous pearl-white base, royal-blue panels, warm-gold trim, cyan energy accents, friendly floating assistant orb during work, holographic interfaces |

Avoid gloomy dark palettes, flat recolor overlays, full-body tint washes,
photorealism, text, logos, detached decorative clutter, and changes to
Wangzai's face or body proportions.

## Current Redraw Pass

Accepted canonical references live in `canonical/`. Earlier animation attempts
under `rejected/body-drift/` are retained only as negative examples: they drifted
toward taller, heavier humanoid proportions.

The current follow-up pass stores corrected generated strips in `strips/`:

- `wangzai-lv2-idle-natural-strip.png`
- `wangzai-lv2-drag-right-strip.png`
- `wangzai-lv4-working-strip.png`
- `wangzai-lv4-review-strip.png`

Run the redraw preview builder from the repository root:

```bash
python3 assets/source/wangzai-level-redraw/build-redraw-apng.py
```

It writes transparent APNG previews to `apng/` and a visual QA sheet to
`qa/wangzai-level-redraw-contact-sheet.png`. The builder extracts each frame by
component anchors instead of equal slot cuts, removes chroma-key fragments, and
normalizes purple hologram remnants into the allowed cyan control language.
