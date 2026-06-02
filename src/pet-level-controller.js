"use strict";

// ── Pet level controller (main-process orchestrator) ──
//
// Ties the leveling system together: poll the (mockable) token source, convert
// the result into upgrade experience, persist any change through the settings
// controller, and — only when the LEVEL itself changes — force a skin reload
// and tell the renderer to celebrate.
//
// Design notes:
//   - Dependency-injection factory (no direct Electron / store / timer access)
//     so the poll logic is unit-testable without real timers or a live app.
//   - NEVER downgrades the persisted level. A transient source reset (the mock
//     returning 0, or the real API briefly resetting) must not strip a hard-won
//     skin: level = max(storedLevel, computedLevel).
//   - Persists whenever the level OR the stored token total changed, but only
//     reloads the skin + broadcasts on a LEVEL change.
//   - Honors the `petLevelEnabled` pref: when disabled, start() is a no-op and
//     the poll short-circuits.
//
// Deps:
//   fetchTokenTotal   async () => { totalTokens, sources?, bonusExperience?, asOf }
//   settingsController { get(key), applyCommand(name, payload) }
//   themeRuntime      { reloadActiveTheme() }             (force-reload entry)
//   broadcast         (channel, payload) => void          (send to renderer)
//   intervalMs        poll cadence (default 60_000)
//   setInterval / clearInterval   timer injection (default globals)
//   log               (...args) => void                   (default no-op)

const {
  computeExperience,
  computeLevelFromExperience,
  nextThreshold,
  MIN_LEVEL,
  MAX_LEVEL,
} = require("./pet-level");

const PET_LEVEL_CHANGE_CHANNEL = "pet-level-change";
const DEFAULT_INTERVAL_MS = 60_000;

function clampStoredLevel(value) {
  if (!Number.isInteger(value)) return MIN_LEVEL;
  if (value < MIN_LEVEL) return MIN_LEVEL;
  if (value > MAX_LEVEL) return MAX_LEVEL;
  return value;
}

function normalizeTokenTotal(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function createPetLevelController(deps = {}) {
  const fetchTokenTotal = deps.fetchTokenTotal;
  const settingsController = deps.settingsController;
  if (typeof fetchTokenTotal !== "function") {
    throw new Error("createPetLevelController requires deps.fetchTokenTotal");
  }
  if (!settingsController || typeof settingsController.get !== "function"
      || typeof settingsController.applyCommand !== "function") {
    throw new Error("createPetLevelController requires deps.settingsController with get/applyCommand");
  }

  const themeRuntime = deps.themeRuntime || null;
  const broadcast = typeof deps.broadcast === "function" ? deps.broadcast : () => {};
  const intervalMs = Number.isFinite(deps.intervalMs) && deps.intervalMs > 0
    ? deps.intervalMs
    : DEFAULT_INTERVAL_MS;
  const setIntervalFn = deps.setInterval || setInterval;
  const clearIntervalFn = deps.clearInterval || clearInterval;
  const log = typeof deps.log === "function" ? deps.log : () => {};

  let timer = null;
  let started = false;
  // Re-entrancy guard: poll() is async; an interval tick must not stack a
  // second fetch on top of one already in flight on a slow source.
  let polling = false;

  function isEnabled() {
    return settingsController.get("petLevelEnabled") !== false;
  }

  // One poll cycle. Resolves once the (optional) persist completes so callers
  // (and tests) can await the full effect. Swallows errors — a flaky source
  // must never crash the interval or the app.
  async function poll() {
    if (!isEnabled()) return;
    if (polling) return;
    polling = true;
    try {
      const result = await fetchTokenTotal();
      const totalTokens = normalizeTokenTotal(result && result.totalTokens);
      const experience = computeExperience({
        totalTokens,
        bonusExperience: result && result.bonusExperience,
        sources: (result && (result.sources || result.experienceSources)) || [],
      });
      const computed = computeLevelFromExperience(experience);

      const storedLevel = clampStoredLevel(settingsController.get("petLevel"));
      const storedTotalRaw = settingsController.get("petLevelTokenTotal");
      const storedTotal = normalizeTokenTotal(storedTotalRaw);

      // Monotonic level: a source reset can lower `computed`, never the level.
      const nextLevel = Math.max(storedLevel, computed);
      const levelChanged = nextLevel !== storedLevel;
      const totalChanged = totalTokens !== storedTotal;

      if (levelChanged || totalChanged) {
        let res;
        try {
          res = await settingsController.applyCommand("setPetLevel", {
            petLevel: nextLevel,
            petLevelTokenTotal: totalTokens,
          });
        } catch (err) {
          log("pet-level: setPetLevel command threw:", err && err.message);
          return;
        }
        if (!res || res.status !== "ok") {
          log("pet-level: setPetLevel rejected:", res && res.message);
          return;
        }
      }

      // Skin reload + celebration are LEVEL-change-only side effects.
      if (levelChanged) {
        if (themeRuntime && typeof themeRuntime.reloadActiveTheme === "function") {
          try {
            themeRuntime.reloadActiveTheme();
          } catch (err) {
            // Windows may not be ready (startup race / shutdown). The persisted
            // level still wins on the next full load, so just log.
            log("pet-level: skin reload failed:", err && err.message);
          }
        }
        try {
          broadcast(PET_LEVEL_CHANGE_CHANNEL, {
            level: nextLevel,
            previousLevel: storedLevel,
            totalTokens,
            experience,
            nextThreshold: nextThreshold(nextLevel),
          });
        } catch (err) {
          log("pet-level: broadcast failed:", err && err.message);
        }
      }
    } catch (err) {
      log("pet-level: poll failed:", err && err.message);
    } finally {
      polling = false;
    }
  }

  // Initial poll + interval. No-op when disabled or already started. Returns the
  // initial poll promise so tests can await the first cycle deterministically.
  function start() {
    if (started) return Promise.resolve();
    started = true;
    if (!isEnabled()) return Promise.resolve();
    const initial = poll();
    timer = setIntervalFn(() => { poll(); }, intervalMs);
    return initial;
  }

  function stop() {
    started = false;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
  }

  function isRunning() {
    return timer !== null;
  }

  return {
    start,
    stop,
    poll,
    isRunning,
    PET_LEVEL_CHANGE_CHANNEL,
  };
}

module.exports = createPetLevelController;
module.exports.createPetLevelController = createPetLevelController;
module.exports.PET_LEVEL_CHANGE_CHANNEL = PET_LEVEL_CHANGE_CHANNEL;
module.exports.DEFAULT_INTERVAL_MS = DEFAULT_INTERVAL_MS;
