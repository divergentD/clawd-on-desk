"use strict";

// ── Pet level engine (pure logic) ──
//
// Maps a cumulative token total onto a pet level (1..4). No Electron, no I/O,
// no state — just deterministic, monotonic math so it's trivially unit-testable.
//
// `LEVEL_THRESHOLDS` lists the cumulative-token requirement for each level,
// indexed by level number. Index 0 is unused (there is no level 0); the array
// is read as thresholds[level]. Levels start at 1 (threshold 0) and climb.
// These are PLACEHOLDER defaults and are expected to be tuned later — keep them
// as a single source of truth so changes are one-line edits.
//
//   level 1 → 0           (everyone starts here)
//   level 2 → 1,000,000
//   level 3 → 10,000,000
//   level 4 → 50,000,000  (max)

const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

const LEVEL_THRESHOLDS = [
  // index 0 unused — levels are 1-based
  0,
  0,
  1_000_000,
  10_000_000,
  50_000_000,
];

// Resolve a token total to a level in [1, 4]. Non-finite / negative inputs
// clamp to level 1. Exact boundary values promote to the higher level
// (totalTokens >= threshold). Monotonic non-decreasing in totalTokens.
function computeLevel(totalTokens) {
  if (typeof totalTokens !== "number" || !Number.isFinite(totalTokens) || totalTokens < 0) {
    return MIN_LEVEL;
  }
  let level = MIN_LEVEL;
  for (let candidate = MIN_LEVEL + 1; candidate <= MAX_LEVEL; candidate++) {
    if (totalTokens >= LEVEL_THRESHOLDS[candidate]) {
      level = candidate;
    } else {
      break;
    }
  }
  return level;
}

// Token total required to reach the next level above `level`. Returns null at
// (or above) the max level, and treats out-of-range / non-integer input by
// clamping to the nearest valid level first.
function nextThreshold(level) {
  let lvl = Number.isFinite(level) ? Math.floor(level) : MIN_LEVEL;
  if (lvl < MIN_LEVEL) lvl = MIN_LEVEL;
  if (lvl >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[lvl + 1];
}

module.exports = {
  LEVEL_THRESHOLDS,
  MIN_LEVEL,
  MAX_LEVEL,
  computeLevel,
  nextThreshold,
};
