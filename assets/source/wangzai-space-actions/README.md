# Wangzai Space Actions

These assets extend the existing Wangzai astronaut robot without changing its
base identity. The production APNG files live under `themes/wangzai/assets/`.

## Action Map

| Asset | Runtime use | Motion idea |
| --- | --- | --- |
| `wangzai-idle-breathing.apng` | Random idle animation | Quiet breathing, blink, smile eyes, antenna bob |
| `wangzai-flight-console.apng` | Working, one session | Typing on a spacecraft control console |
| `wangzai-satellite-rack.apng` | Juggling, two sessions | Coordinating satellite modules on a deployment rack |
| `wangzai-rover-welding.apng` | Working, three or more sessions | Repairing a Mars rover with a welding torch |
| `wangzai-sample-vacuum.apng` | Sweeping | Cleaning with an astronaut sample vacuum |
| `wangzai-carrying-module.apng` | Carrying | Transporting a satellite equipment case |

## Source Layout

- `references/`: canonical robot reference extracted from the existing atlas
- `generated/`: selected chroma-key source strips from built-in image generation
- `qa/`: extracted frames and contact sheets used for visual review
- `build-action-apng.py`: deterministic strip-to-APNG converter

The converter uses the installed `hatch-pet` frame extractor and exports six
transparent `192x208` APNG frames with stable slot sizing.
