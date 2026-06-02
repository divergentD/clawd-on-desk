"use strict";

// ── Pet level engine (pure logic) ──
//
// Maps upgrade experience onto a pet level (1..4). No Electron, no I/O, no
// state — just deterministic, monotonic math so it's trivially unit-testable.
//
// `LEVEL_THRESHOLDS` lists the upgrade-experience requirement for each level,
// indexed by level number. Index 0 is unused (there is no level 0). Today token
// totals convert to experience at 1:1, but the conversion is intentionally kept
// in computeExperience() so future mechanics (achievements, streaks, etc.) can
// add experience without changing the level resolver.
//
//   level 1 → 0           (everyone starts here)
//   level 2 → 100,000,000
//   level 3 → 1,000,000,000
//   level 4 → 5,000,000,000  (max)

const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

const LEVEL_THRESHOLDS = [
  // index 0 unused — levels are 1-based
  0,
  0,
  100_000_000,
  1_000_000_000,
  5_000_000_000,
];

function normalizeExperience(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

// Convert current progression inputs into upgrade experience. The only source
// today is cumulative token total (1 token = 1 XP), but callers can already pass
// additive sources so future non-token mechanics have a stable contract.
function computeExperience(input = {}) {
  if (typeof input === "number") return normalizeExperience(input);
  const totalTokens = normalizeExperience(input && input.totalTokens);
  const bonusExperience = normalizeExperience(input && input.bonusExperience);
  const sources = Array.isArray(input && input.sources) ? input.sources : [];
  const sourceExperience = sources.reduce((sum, source) => (
    sum + normalizeExperience(source && source.experience)
  ), 0);
  return totalTokens + bonusExperience + sourceExperience;
}

// Resolve upgrade experience to a level in [1, 4]. Non-finite / negative inputs
// clamp to level 1. Exact boundary values promote to the higher level.
function computeLevelFromExperience(experience) {
  if (typeof experience !== "number" || !Number.isFinite(experience) || experience < 0) {
    return MIN_LEVEL;
  }
  let level = MIN_LEVEL;
  for (let candidate = MIN_LEVEL + 1; candidate <= MAX_LEVEL; candidate++) {
    if (experience >= LEVEL_THRESHOLDS[candidate]) {
      level = candidate;
    } else {
      break;
    }
  }
  return level;
}

// Backwards-compatible helper for today's token-only source.
function computeLevel(totalTokens) {
  return computeLevelFromExperience(computeExperience({ totalTokens }));
}

// Experience required to reach the next level above `level`. Returns null at
// (or above) the max level.
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
  computeExperience,
  computeLevel,
  computeLevelFromExperience,
  nextThreshold,
};
