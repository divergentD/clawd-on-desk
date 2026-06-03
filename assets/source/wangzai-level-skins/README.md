# Wangzai Level Skins

Wangzai levels preserve the Lv.1 astronaut robot and every existing APNG state
meaning. Higher levels progressively upgrade the suit, helmet, and work tools:

| Level | Ornament |
| --- | --- |
| Lv.2 | Pearl-white explorer suit with sky-blue chest/cuff panels and a gold mission badge |
| Lv.3 | Pearl-white flight-engineer suit with stronger sapphire paneling, side fins, and cyan energy inlays |
| Lv.4 | Bright white/gold command suit with royal-blue panels, a three-ray crest, holographic review panel, and a floating assistant orb during active work |

Run the deterministic builder from the repository root:

```bash
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/build-level-skins.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/make-contact-sheet.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/make-motion-sheet.py
```

The builder locates the dark visor in every source APNG frame, lightly cools
only neutral suit pixels, then redraws attached suit panels relative to the
same Lv.1 body. It writes `wangzai-lv2-*` through `wangzai-lv4-*` files into
`themes/wangzai/assets/`.

The Python scripts require Pillow, matching the existing Wangzai APNG source
tooling under `assets/source/wangzai-space-actions/`.
