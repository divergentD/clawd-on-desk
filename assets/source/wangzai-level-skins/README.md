# Wangzai Level Skins

Wangzai levels preserve the Lv.1 astronaut robot silhouette and every existing
APNG state meaning. The accepted Lv.2 redraw set from
`assets/source/wangzai-level-redraw/` is the current visual source of truth;
higher levels progressively upgrade that suit, helmet, and work tooling:

| Level | Ornament |
| --- | --- |
| Lv.2 | Origin redraw design: pearl-white explorer suit with sky-blue helmet, chest, cuff, and boot panels |
| Lv.3 | Flight-engineer upgrade: stronger cyan-blue paneling, side fins, and holographic work/review controls |
| Lv.4 | Command upgrade: gold/cyan crest, bigger holographic controls, and a floating assistant orb in the designed key states |

Run the deterministic builder from the repository root:

```bash
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-redraw/install-theme-assets.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/build-level-skins.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-redraw/install-theme-assets.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/make-contact-sheet.py
/Users/zhouxinyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 assets/source/wangzai-level-skins/make-motion-sheet.py
```

The redraw installer copies approved Lv.2 APNGs into `themes/wangzai/assets/`,
mirrors `drag-right` into `drag-left`, and applies the approved Lv.4
working/review key-state APNGs. The level-skin builder then locates the dark
visor in every Lv.2 APNG frame, lightly cools only neutral suit pixels, and
draws attached Lv.3/Lv.4 suit panels relative to the same body. Running the
installer a second time restores the hand-redrawn Lv.4 key states after the
batch builder has filled the remaining Lv.4 state set.

The Python scripts require Pillow, matching the existing Wangzai APNG source
tooling under `assets/source/wangzai-space-actions/`.
