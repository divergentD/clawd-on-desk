"use strict";

const {
  isPlainObject,
  getStateBindingEntry,
  getStateFiles,
  deepMergeObject,
  basenameOnly,
} = require("./theme-schema");

// Pet levels are full skin swaps keyed by string "2".."4" inside `theme.levels`.
// Level 1 is the base theme (no patch). Unlike variants, a level MAY override
// `states` (and miniMode states) because a level is a whole new skin, not a
// cosmetic tweak.
const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

// Allow-list of fields a level may override. Anything else is ignored with a
// warning so author typos are visible without breaking theme load. Unlike the
// variant allow-list, this DOES include `states`, `miniMode`, `reactions`, and
// `eyeTracking` because a level ships a complete state set.
const LEVEL_ALLOWED_KEYS = new Set([
  // Metadata (not merged into runtime theme)
  "name", "description", "preview",
  // Runtime fields
  "states", "miniMode", "reactions",
  "workingTiers", "jugglingTiers", "idleAnimations",
  "displayHintMap", "sleepingHitboxFiles",
  "eyeTracking", "objectScale",
]);

// Fields that replace wholesale instead of deep-merge. Arrays always replace.
const LEVEL_REPLACE_FIELDS = new Set([
  "workingTiers", "jugglingTiers", "idleAnimations",
]);

/**
 * Clamp/parse a requested level to a valid integer in [MIN_LEVEL, MAX_LEVEL].
 * Anything absent or invalid defaults to MIN_LEVEL (1 = base skin).
 * @param {*} value
 * @returns {number}
 */
function normalizeLevel(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < MIN_LEVEL || n > MAX_LEVEL) return MIN_LEVEL;
  return n;
}

/**
 * Resolve the level spec for a requested level.
 *
 * Level 1 always resolves to the base theme (spec = null, no patch). A missing
 * level (no `theme.levels["N"]`) also resolves to a null spec so the loader
 * gracefully falls back to the base skin — but `resolvedLevel` still reflects
 * the requested numeric level so callers (dedup/short-circuit) can distinguish
 * a level-3-no-art pet from a level-4-no-art pet.
 *
 * @param {object} raw - raw theme JSON (post variant patch)
 * @param {*} requestedLevel
 * @returns {{ resolvedLevel: number, spec: object|null }}
 */
function resolveLevel(raw, requestedLevel) {
  const resolvedLevel = normalizeLevel(requestedLevel);
  if (resolvedLevel <= MIN_LEVEL) {
    return { resolvedLevel: MIN_LEVEL, spec: null };
  }
  const levels = isPlainObject(raw && raw.levels) ? raw.levels : {};
  const spec = levels[String(resolvedLevel)];
  if (isPlainObject(spec)) {
    return { resolvedLevel, spec };
  }
  return { resolvedLevel, spec: null };
}

// Per-state-key merge with graceful asset fallback. A level state whose
// referenced file(s) do not exist on disk keeps the base theme's slot instead
// of pointing the renderer at a missing asset.
function applyLevelStates(baseStates, levelStates, assetExists) {
  const out = isPlainObject(baseStates) ? { ...baseStates } : {};
  if (!isPlainObject(levelStates)) return out;
  for (const [stateKey, entry] of Object.entries(levelStates)) {
    if (stateKey.startsWith("_")) continue;
    const binding = getStateBindingEntry(entry);
    if (binding.files.length > 0) {
      if (binding.files.every((file) => assetExists(basenameOnly(file)))) {
        out[stateKey] = entry;
      }
      // else: missing asset → keep base slot (graceful fallback)
    } else if (binding.fallbackTo) {
      out[stateKey] = entry;
    }
    // else: malformed entry with no files/fallbackTo → keep base slot
  }
  return out;
}

// miniMode is merged field-by-field; its `states` map gets the same per-key
// asset-existence fallback as the top-level states.
function applyLevelMiniMode(baseMiniMode, levelMiniMode, assetExists) {
  if (!isPlainObject(levelMiniMode)) return baseMiniMode;
  const base = isPlainObject(baseMiniMode) ? baseMiniMode : {};
  const { states: levelStates, ...levelRest } = levelMiniMode;
  const out = isPlainObject(base) && Object.keys(base).length > 0
    ? deepMergeObject(base, levelRest)
    : { ...levelRest };

  const baseStates = isPlainObject(base.states) ? base.states : {};
  if (isPlainObject(levelStates)) {
    const nextStates = { ...baseStates };
    for (const [stateKey, files] of Object.entries(levelStates)) {
      if (stateKey.startsWith("_")) continue;
      if (Array.isArray(files) && files.length > 0
        && files.every((file) => assetExists(basenameOnly(file)))) {
        nextStates[stateKey] = files;
      }
      // else: missing asset → keep base slot
    }
    out.states = nextStates;
  } else if (Object.keys(baseStates).length > 0) {
    out.states = { ...baseStates };
  }
  return out;
}

// Collect the asset basenames a single allow-listed field references. Used to
// decide whether a field-level override must fall back to base.
function levelFieldAssetFiles(key, value) {
  const files = [];
  const push = (file) => {
    const bn = basenameOnly(file);
    if (typeof bn === "string" && bn) files.push(bn);
  };
  if (key === "workingTiers" || key === "jugglingTiers" || key === "idleAnimations") {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (isPlainObject(entry) && typeof entry.file === "string") push(entry.file);
      }
    }
  } else if (key === "displayHintMap") {
    if (isPlainObject(value)) {
      for (const file of Object.values(value)) push(file);
    }
  } else if (key === "sleepingHitboxFiles") {
    if (Array.isArray(value)) {
      for (const file of value) push(file);
    }
  } else if (key === "reactions") {
    if (isPlainObject(value)) {
      for (const entry of Object.values(value)) {
        if (!isPlainObject(entry)) continue;
        if (typeof entry.file === "string") push(entry.file);
        if (typeof entry.fileLeft === "string") push(entry.fileLeft);
        if (typeof entry.fileRight === "string") push(entry.fileRight);
        if (Array.isArray(entry.files)) {
          for (const file of entry.files) if (typeof file === "string") push(file);
        }
      }
    }
  }
  // states / miniMode get per-slot fallback elsewhere; eyeTracking / objectScale
  // carry no asset filenames.
  return files;
}

/**
 * Apply a level patch onto the raw theme object. Mirrors applyVariantPatch but
 * permits `states`/`miniMode` and adds graceful asset fallback: any slot whose
 * referenced asset file does not exist (per opts.assetExists) falls back to the
 * base theme's value for that slot instead of throwing. When no assetExists
 * predicate is supplied, every asset is treated as present (used by pure merge
 * tests).
 *
 * @param {object} raw - raw theme JSON (post variant patch)
 * @param {object} levelSpec - theme.levels["N"]
 * @param {string} themeId
 * @param {number} levelId
 * @param {{ assetExists?: (filename: string) => boolean }} [opts]
 * @returns {object} patched raw
 */
function applyLevelPatch(raw, levelSpec, themeId, levelId, opts = {}) {
  if (!isPlainObject(levelSpec)) return raw;
  const assetExists = typeof opts.assetExists === "function" ? opts.assetExists : () => true;
  const patched = { ...raw };
  for (const [key, value] of Object.entries(levelSpec)) {
    if (key === "name" || key === "description" || key === "preview") continue;
    if (key.startsWith("_")) continue;
    if (!LEVEL_ALLOWED_KEYS.has(key)) {
      console.warn(`[theme-loader] level "${themeId}:${levelId}" declares ignored field "${key}" (not in allow-list)`);
      continue;
    }
    if (key === "states") {
      patched.states = applyLevelStates(raw.states, value, assetExists);
      continue;
    }
    if (key === "miniMode") {
      patched.miniMode = applyLevelMiniMode(raw.miniMode, value, assetExists);
      continue;
    }
    const refFiles = levelFieldAssetFiles(key, value);
    if (refFiles.some((file) => !assetExists(file))) {
      console.warn(`[theme-loader] level "${themeId}:${levelId}" field "${key}" references a missing asset; falling back to base`);
      continue; // keep base value for this slot
    }
    if (LEVEL_REPLACE_FIELDS.has(key) || Array.isArray(value)) {
      patched[key] = value;
    } else if (isPlainObject(value)) {
      patched[key] = isPlainObject(patched[key]) ? deepMergeObject(patched[key], value) : value;
    } else {
      patched[key] = value;
    }
  }
  return patched;
}

/**
 * Collect, per level, the basename-only asset files each level references.
 * Used by the theme validator/asset checker to surface (warn on) missing
 * per-level art without duplicating the merge logic.
 *
 * @param {object} raw - raw theme JSON
 * @returns {Record<string, string[]>} level key -> basename list
 */
function collectLevelAssetFiles(raw) {
  const out = {};
  const levels = isPlainObject(raw && raw.levels) ? raw.levels : {};
  for (const [levelKey, spec] of Object.entries(levels)) {
    if (!isPlainObject(spec)) continue;
    const files = new Set();
    const add = (file) => {
      const bn = basenameOnly(file);
      if (typeof bn === "string" && bn) files.add(bn);
    };
    if (isPlainObject(spec.states)) {
      for (const entry of Object.values(spec.states)) {
        for (const file of getStateFiles(entry)) add(file);
      }
    }
    if (isPlainObject(spec.miniMode) && isPlainObject(spec.miniMode.states)) {
      for (const arr of Object.values(spec.miniMode.states)) {
        if (Array.isArray(arr)) for (const file of arr) add(file);
      }
    }
    for (const field of ["workingTiers", "jugglingTiers", "idleAnimations"]) {
      if (Array.isArray(spec[field])) {
        for (const entry of spec[field]) {
          if (isPlainObject(entry) && typeof entry.file === "string") add(entry.file);
        }
      }
    }
    if (isPlainObject(spec.displayHintMap)) {
      for (const file of Object.values(spec.displayHintMap)) add(file);
    }
    if (Array.isArray(spec.sleepingHitboxFiles)) {
      for (const file of spec.sleepingHitboxFiles) add(file);
    }
    if (isPlainObject(spec.reactions)) {
      for (const entry of Object.values(spec.reactions)) {
        if (!isPlainObject(entry)) continue;
        for (const k of ["file", "fileLeft", "fileRight"]) {
          if (typeof entry[k] === "string") add(entry[k]);
        }
        if (Array.isArray(entry.files)) {
          for (const file of entry.files) if (typeof file === "string") add(file);
        }
      }
    }
    out[levelKey] = [...files];
  }
  return out;
}

module.exports = {
  MIN_LEVEL,
  MAX_LEVEL,
  LEVEL_ALLOWED_KEYS,
  LEVEL_REPLACE_FIELDS,
  normalizeLevel,
  resolveLevel,
  applyLevelPatch,
  applyLevelStates,
  applyLevelMiniMode,
  collectLevelAssetFiles,
};
