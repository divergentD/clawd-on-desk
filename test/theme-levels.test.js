"use strict";

const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  MIN_LEVEL,
  MAX_LEVEL,
  LEVEL_ALLOWED_KEYS,
  LEVEL_REPLACE_FIELDS,
  normalizeLevel,
  resolveLevel,
  applyLevelPatch,
  applyLevelMiniMode,
  collectLevelAssetFiles,
} = require("../src/theme-levels");
const themeLoader = require("../src/theme-loader");

afterEach(() => {
  mock.restoreAll();
});

function baseTheme(overrides = {}) {
  return {
    name: "Base",
    states: {
      idle: ["idle.svg"],
      working: ["working.svg"],
      thinking: ["thinking.svg"],
      sleeping: { files: ["sleep.svg"], fallbackTo: null },
    },
    miniMode: {
      supported: true,
      offsetRatio: 0.4,
      states: {
        "mini-idle": ["mini-idle.svg"],
        "mini-happy": ["mini-happy.svg"],
      },
    },
    workingTiers: [
      { minSessions: 1, file: "typing.svg" },
      { minSessions: 3, file: "building.svg" },
    ],
    jugglingTiers: [{ minSessions: 2, file: "juggle.svg" }],
    idleAnimations: [{ file: "look.svg", duration: 1200 }],
    objectScale: { widthRatio: 1.9, heightRatio: 1.3 },
    ...overrides,
  };
}

describe("theme level resolution", () => {
  it("treats level 1 as the base skin with no patch", () => {
    const raw = { levels: { "2": { states: { idle: ["lvl2.svg"] } } } };
    assert.deepStrictEqual(resolveLevel(raw, 1), { resolvedLevel: 1, spec: null });
    // absent/invalid level option also resolves to base
    assert.deepStrictEqual(resolveLevel(raw, undefined), { resolvedLevel: 1, spec: null });
  });

  it("resolves a declared level to its spec", () => {
    const raw = { levels: { "2": { states: { idle: ["lvl2.svg"] } } } };
    assert.deepStrictEqual(resolveLevel(raw, 2), {
      resolvedLevel: 2,
      spec: raw.levels["2"],
    });
  });

  it("falls back to base (null spec) for a missing level but keeps the requested numeric level", () => {
    const raw = { levels: { "2": { states: { idle: ["lvl2.svg"] } } } };
    assert.deepStrictEqual(resolveLevel(raw, 3), { resolvedLevel: 3, spec: null });
    assert.deepStrictEqual(resolveLevel({}, 4), { resolvedLevel: 4, spec: null });
  });

  it("normalizes invalid/out-of-range levels to the base level", () => {
    assert.strictEqual(normalizeLevel(undefined), MIN_LEVEL);
    assert.strictEqual(normalizeLevel("not-a-number"), MIN_LEVEL);
    assert.strictEqual(normalizeLevel(0), MIN_LEVEL);
    assert.strictEqual(normalizeLevel(MAX_LEVEL + 1), MIN_LEVEL);
    assert.strictEqual(normalizeLevel("3"), 3);
    assert.strictEqual(normalizeLevel(4.9), MAX_LEVEL);
  });
});

describe("theme level patching", () => {
  it("merges states per slot and leaves unspecified states on the base", () => {
    const raw = baseTheme();
    const patched = applyLevelPatch(raw, {
      states: {
        idle: ["lvl2-idle.svg"],
        working: ["lvl2-working.svg"],
      },
    }, "demo", 2);

    assert.deepStrictEqual(patched.states.idle, ["lvl2-idle.svg"]);
    assert.deepStrictEqual(patched.states.working, ["lvl2-working.svg"]);
    // untouched slot keeps base value
    assert.deepStrictEqual(patched.states.thinking, ["thinking.svg"]);
    assert.deepStrictEqual(patched.states.sleeping, { files: ["sleep.svg"], fallbackTo: null });
    // base object is not mutated
    assert.deepStrictEqual(raw.states.idle, ["idle.svg"]);
    assert.notStrictEqual(patched.states, raw.states);
  });

  it("falls back to the base slot when a referenced state asset is missing", () => {
    const raw = baseTheme();
    const assetExists = (file) => file !== "missing-idle.svg";
    const patched = applyLevelPatch(raw, {
      states: {
        idle: ["missing-idle.svg"],
        working: ["lvl2-working.svg"],
      },
    }, "demo", 2, { assetExists });

    // missing asset → base slot preserved
    assert.deepStrictEqual(patched.states.idle, ["idle.svg"]);
    // present asset → applied
    assert.deepStrictEqual(patched.states.working, ["lvl2-working.svg"]);
  });

  it("replaces array fields wholesale instead of deep-merging", () => {
    const raw = baseTheme();
    const patched = applyLevelPatch(raw, {
      workingTiers: [{ minSessions: 5, file: "solo.svg" }],
      idleAnimations: [{ file: "lvl-look.svg", duration: 999 }],
    }, "demo", 2);

    assert.deepStrictEqual(patched.workingTiers, [{ minSessions: 5, file: "solo.svg" }]);
    assert.deepStrictEqual(patched.idleAnimations, [{ file: "lvl-look.svg", duration: 999 }]);
    // base array untouched
    assert.strictEqual(raw.workingTiers.length, 2);
  });

  it("falls back to the base value when a replace-field asset is missing", () => {
    const raw = baseTheme();
    const assetExists = (file) => file !== "gone.svg";
    const patched = applyLevelPatch(raw, {
      workingTiers: [{ minSessions: 5, file: "gone.svg" }],
    }, "demo", 2, { assetExists });

    assert.deepStrictEqual(patched.workingTiers, raw.workingTiers);
  });

  it("deep-merges plain-object fields like objectScale", () => {
    const raw = baseTheme();
    const patched = applyLevelPatch(raw, {
      objectScale: { widthRatio: 2.2 },
    }, "demo", 2);

    assert.deepStrictEqual(patched.objectScale, { widthRatio: 2.2, heightRatio: 1.3 });
  });

  it("merges miniMode states per slot while preserving other miniMode fields", () => {
    const raw = baseTheme();
    const patched = applyLevelPatch(raw, {
      miniMode: { states: { "mini-idle": ["lvl-mini-idle.svg"] } },
    }, "demo", 2);

    assert.deepStrictEqual(patched.miniMode.states["mini-idle"], ["lvl-mini-idle.svg"]);
    assert.deepStrictEqual(patched.miniMode.states["mini-happy"], ["mini-happy.svg"]);
    assert.strictEqual(patched.miniMode.supported, true);
    assert.strictEqual(patched.miniMode.offsetRatio, 0.4);
  });

  it("ignores fields outside the level allow-list with a warning and skips metadata", () => {
    const warn = mock.method(console, "warn", () => {});
    const raw = baseTheme();
    const patched = applyLevelPatch(raw, {
      name: "Level Two",
      bogusField: { nope: true },
      states: { idle: ["lvl2-idle.svg"] },
    }, "demo", 2);

    assert.strictEqual(patched.bogusField, undefined);
    // metadata name is not merged into runtime theme
    assert.strictEqual(patched.name, "Base");
    assert.deepStrictEqual(patched.states.idle, ["lvl2-idle.svg"]);
    assert.strictEqual(warn.mock.calls.length, 1);
    assert.ok(warn.mock.calls[0].arguments[0].includes("bogusField"));
  });

  it("returns the raw object unchanged for an empty/invalid level spec", () => {
    const raw = baseTheme();
    assert.strictEqual(applyLevelPatch(raw, null, "demo", 2), raw);
  });
});

describe("theme level allow-list shape", () => {
  it("permits full-skin fields (states + miniMode) and array replace fields", () => {
    for (const key of ["states", "miniMode", "reactions", "workingTiers", "jugglingTiers", "idleAnimations", "displayHintMap", "sleepingHitboxFiles", "eyeTracking", "objectScale"]) {
      assert.ok(LEVEL_ALLOWED_KEYS.has(key), `expected level allow-list to include ${key}`);
    }
    for (const key of ["workingTiers", "jugglingTiers", "idleAnimations"]) {
      assert.ok(LEVEL_REPLACE_FIELDS.has(key), `expected ${key} to replace wholesale`);
    }
  });
});

describe("collectLevelAssetFiles", () => {
  it("flattens per-level asset references and skips non-object level entries", () => {
    const raw = {
      levels: {
        _comment: "ignored",
        "2": {
          states: { idle: ["a.svg"], working: ["b.svg"] },
          miniMode: { states: { "mini-idle": ["m.svg"] } },
        },
        "4": {
          workingTiers: [{ minSessions: 1, file: "c.svg" }],
          reactions: { drag: { file: "d.svg" } },
          displayHintMap: { "base.svg": "e.svg" },
          sleepingHitboxFiles: ["f.svg"],
        },
      },
    };
    const out = collectLevelAssetFiles(raw);
    assert.deepStrictEqual(out["2"].sort(), ["a.svg", "b.svg", "m.svg"]);
    assert.deepStrictEqual(out["4"].sort(), ["c.svg", "d.svg", "e.svg", "f.svg"]);
    assert.ok(!("_comment" in out));
  });
});

// ── Integration: loadTheme level option drives the skin swap end-to-end ──

function makeLevelFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wang-pet-level-"));
  const appDir = path.join(tmp, "src");
  const svgDir = path.join(tmp, "assets", "svg");
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(svgDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, "assets", "sounds"), { recursive: true });
  const userData = path.join(tmp, "userData");
  fs.mkdirSync(path.join(userData, "themes"), { recursive: true });

  // Built-in theme assets live in assets/svg/. Everything except
  // lvl3-missing.svg exists, so level 3's idle slot must fall back to base.
  for (const file of [
    "idle.svg", "working.svg", "thinking.svg", "sleeping.svg",
    "lvl2-idle.svg", "lvl2-working.svg", "lvl3-working.svg",
  ]) {
    fs.writeFileSync(path.join(svgDir, file), "<svg></svg>", "utf8");
  }

  const themeDir = path.join(tmp, "themes", "demo");
  fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify({
    schemaVersion: 1,
    name: "Demo",
    version: "1.0.0",
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    sleepSequence: { mode: "direct" },
    states: {
      idle: ["idle.svg"],
      working: ["working.svg"],
      thinking: ["thinking.svg"],
      sleeping: ["sleeping.svg"],
    },
    levels: {
      "2": {
        states: { idle: ["lvl2-idle.svg"], working: ["lvl2-working.svg"] },
      },
      "3": {
        states: { idle: ["lvl3-missing.svg"], working: ["lvl3-working.svg"] },
      },
    },
  }), "utf8");

  themeLoader.init(appDir, userData);
  return { tmp, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

describe("loadTheme level option", () => {
  it("applies the level skin, defaults to level 1, and gracefully falls back on missing art", () => {
    const fixture = makeLevelFixture();
    try {
      const base = themeLoader.loadTheme("demo", { strict: true });
      assert.strictEqual(base._levelId, 1);
      assert.deepStrictEqual(base.states.idle, ["idle.svg"]);
      assert.deepStrictEqual(base.states.working, ["working.svg"]);

      const lvl2 = themeLoader.loadTheme("demo", { strict: true, level: 2 });
      assert.strictEqual(lvl2._levelId, 2);
      assert.deepStrictEqual(lvl2.states.idle, ["lvl2-idle.svg"]);
      assert.deepStrictEqual(lvl2.states.working, ["lvl2-working.svg"]);

      const lvl3 = themeLoader.loadTheme("demo", { strict: true, level: 3 });
      assert.strictEqual(lvl3._levelId, 3);
      // lvl3-missing.svg does not exist → idle falls back to the base slot
      assert.deepStrictEqual(lvl3.states.idle, ["idle.svg"]);
      // lvl3-working.svg exists → applied
      assert.deepStrictEqual(lvl3.states.working, ["lvl3-working.svg"]);

      // A missing level (4 is not declared) keeps the base skin but records the level.
      const lvl4 = themeLoader.loadTheme("demo", { strict: true, level: 4 });
      assert.strictEqual(lvl4._levelId, 4);
      assert.deepStrictEqual(lvl4.states.idle, ["idle.svg"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("uses existing visibly distinct clawd skins for levels 2 through 4", () => {
    themeLoader.init(path.join(__dirname, "..", "src"));

    const lvl2 = themeLoader.loadTheme("clawd", { strict: true, level: 2 });
    assert.strictEqual(lvl2._levelId, 2);
    assert.deepStrictEqual(lvl2.states.idle, ["clawd-working-typing-boss.svg"]);
    assert.deepStrictEqual(lvl2.states.working, ["clawd-working-typing-boss.svg"]);
    assert.deepStrictEqual(lvl2.workingTiers, [{ minSessions: 1, file: "clawd-working-typing-boss.svg" }]);

    const lvl3 = themeLoader.loadTheme("clawd", { strict: true, level: 3 });
    assert.strictEqual(lvl3._levelId, 3);
    assert.deepStrictEqual(lvl3.states.idle, ["clawd-working-wizard.svg"]);
    assert.deepStrictEqual(lvl3.states.working, ["clawd-working-wizard.svg"]);
    assert.deepStrictEqual(lvl3.workingTiers, [{ minSessions: 1, file: "clawd-working-wizard.svg" }]);

    const lvl4 = themeLoader.loadTheme("clawd", { strict: true, level: 4 });
    assert.strictEqual(lvl4._levelId, 4);
    assert.deepStrictEqual(lvl4.states.idle, ["clawd-working-ultrathink.svg"]);
    assert.deepStrictEqual(lvl4.states.working, ["clawd-working-ultrathink.svg"]);
    assert.deepStrictEqual(lvl4.workingTiers, [{ minSessions: 1, file: "clawd-working-ultrathink.svg" }]);
  });

  it("applies the complete Wangzai ornament skin across states, reactions, hints, hitboxes, and mini mode", () => {
    themeLoader.init(path.join(__dirname, "..", "src"));

    for (const level of [2, 3, 4]) {
      const prefix = `wangzai-lv${level}-`;
      const theme = themeLoader.loadTheme("wangzai", { strict: true, level });
      assert.strictEqual(theme._levelId, level);
      assert.deepStrictEqual(theme.states.idle, [`${prefix}idle-natural.apng`]);
      assert.deepStrictEqual(theme.states.working, [`${prefix}rocket-repair.apng`]);
      assert.strictEqual(theme.reactions.drag.fileLeft, `${prefix}drag-left.apng`);
      assert.strictEqual(theme.displayHintMap["clawd-working-building.svg"], `${prefix}rover-welding.apng`);
      assert.strictEqual(theme.sleepingHitboxFiles[0], `${prefix}sleeping.apng`);
      assert.deepStrictEqual(theme.miniMode.states["mini-idle"], [`${prefix}mini-idle.apng`]);
    }
  });
});
