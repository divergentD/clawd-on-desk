# Wangzai Space Actions

These assets extend the existing Wangzai astronaut robot without changing its
base identity. The production APNG files live under `themes/wangzai/assets/`.

## Action Map

| Asset | Runtime use | Motion idea |
| --- | --- | --- |
| `wangzai-idle-natural.apng` | Random idle animation | Slow breathing, blink, and a seamless return pose |
| `codex-pet-running-loop.svg` | Working, one session | Original rocket repair animation |
| `wangzai-mission-control.apng` | Working, two sessions | Alternating between rover diagnostics and satellite telemetry |
| `wangzai-robotic-arms.apng` | Juggling, two or more subagents | Coordinating attached robotic arms for spacecraft repair |
| `wangzai-rover-welding.apng` | Working, three or more sessions | Repairing a Mars rover with a welding torch |
| `wangzai-sample-vacuum.apng` | Sweeping | Cleaning with an astronaut sample vacuum |
| `wangzai-carrying-module.apng` | Carrying | Transporting a satellite equipment case |
| `wangzai-yawning.apng` through `wangzai-waking.apng` | Full sleep sequence | Powering down into a compact rest pose, then standing back up |
| `wangzai-mini-*.apng` | Mini mode | Compact edge animations for idle, alert, peek, movement, and sleep |

## Source Layout

- `references/`: canonical robot reference extracted from the existing atlas
- `generated/`: selected chroma-key source strips from built-in image generation
- `qa/`: extracted frames and contact sheets used for visual review
- `build-action-apng.py`: deterministic strip-to-APNG converter

The converter uses the installed `hatch-pet` frame extractor and exports
transparent `192x208` APNG frames with stable slot sizing. Use `--ping-pong`
for calm loops that need a seamless return pose.
