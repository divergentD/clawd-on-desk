"use strict";

const test = require("node:test");
const assert = require("node:assert");

const themeOverrideCommands = require("../src/settings-actions-theme-overrides");

test("settings theme override actions expose the command surface", () => {
  assert.deepStrictEqual(Object.keys(themeOverrideCommands).sort(), [
    "ANIMATION_OVERRIDES_EXPORT_VERSION",
    "ONESHOT_OVERRIDE_STATES",
    "importAnimationOverrides",
    "resetThemeOverrides",
    "setAnimationOverride",
    "setSoundOverride",
    "setThemeOverrideDisabled",
    "setWideHitboxOverride",
  ]);
  assert.strictEqual(themeOverrideCommands.ANIMATION_OVERRIDES_EXPORT_VERSION, 1);
  assert.ok(themeOverrideCommands.ONESHOT_OVERRIDE_STATES.has("attention"));
});

test("settings theme override actions update an active state slot with explicit reload data", () => {
  const calls = [];
  const snapshot = {
    theme: "wang-pet",
    themeOverrides: {
      "wang-pet": {
        hitbox: { wide: { "old.svg": true } },
        sounds: { complete: { file: "done.mp3" } },
      },
    },
  };

  const result = themeOverrideCommands.setAnimationOverride(
    {
      themeId: "wang-pet",
      slotType: "state",
      stateKey: "attention",
      file: "new-attention.svg",
      transition: { in: 80, out: 120 },
      autoReturnMs: 2500,
    },
    {
      snapshot,
      activateTheme: (themeId, variantId, overrideMap) => {
        calls.push({ themeId, variantId, overrideMap });
      },
    }
  );

  assert.strictEqual(result.status, "ok");
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].states.attention, {
    file: "new-attention.svg",
    transition: { in: 80, out: 120 },
  });
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].timings, {
    autoReturn: { attention: 2500 },
  });
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].hitbox, snapshot.themeOverrides["wang-pet"].hitbox);
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].sounds, snapshot.themeOverrides["wang-pet"].sounds);
  assert.deepStrictEqual(calls, [
    {
      themeId: "wang-pet",
      variantId: null,
      overrideMap: result.commit.themeOverrides["wang-pet"],
    },
  ]);
});

test("settings theme override actions clear transition overrides that match the theme default", () => {
  const calls = [];
  const snapshot = {
    theme: "wang-pet",
    themeOverrides: {
      "wang-pet": {
        states: {
          thinking: {
            transition: { in: 160, out: 150 },
          },
        },
      },
    },
  };

  const result = themeOverrideCommands.setAnimationOverride(
    {
      themeId: "wang-pet",
      slotType: "state",
      stateKey: "thinking",
      transition: { in: 150, out: 150 },
      transitionThemeDefault: { in: 150, out: 150 },
    },
    {
      snapshot,
      activateTheme: (themeId, variantId, overrideMap) => {
        calls.push({ themeId, variantId, overrideMap });
      },
    }
  );

  assert.strictEqual(result.status, "ok");
  assert.strictEqual(result.commit.themeOverrides["wang-pet"], undefined);
  assert.deepStrictEqual(calls, [
    {
      themeId: "wang-pet",
      variantId: null,
      overrideMap: {},
    },
  ]);
});

test("settings theme override actions keep transition overrides that differ from the theme default", () => {
  const result = themeOverrideCommands.setAnimationOverride(
    {
      themeId: "wang-pet",
      slotType: "state",
      stateKey: "thinking",
      transition: { in: 160, out: 150 },
      transitionThemeDefault: { in: 150, out: 150 },
    },
    {
      snapshot: { theme: "other", themeOverrides: {} },
      activateTheme: () => {
        throw new Error("inactive theme should not reload");
      },
    }
  );

  assert.strictEqual(result.status, "ok");
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].states.thinking, {
    transition: { in: 160, out: 150 },
  });
});

test("settings theme override actions preserve animation and hitbox data when changing sound overrides", () => {
  const snapshot = {
    theme: "calico",
    themeOverrides: {
      "wang-pet": {
        states: { attention: { file: "attention.svg" } },
        reactions: { clickLeft: { file: "click.svg" } },
        hitbox: { wide: { "wide.svg": true } },
        sounds: { confirm: { file: "confirm.wav" } },
      },
    },
  };

  const result = themeOverrideCommands.setSoundOverride(
    { themeId: "wang-pet", soundName: "complete", file: "complete.mp3", originalName: "picked.mp3" },
    {
      snapshot,
      activateTheme: () => {
        throw new Error("inactive theme should not reload");
      },
    }
  );

  assert.strictEqual(result.status, "ok");
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].states, snapshot.themeOverrides["wang-pet"].states);
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].reactions, snapshot.themeOverrides["wang-pet"].reactions);
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].hitbox, snapshot.themeOverrides["wang-pet"].hitbox);
  assert.deepStrictEqual(result.commit.themeOverrides["wang-pet"].sounds, {
    confirm: { file: "confirm.wav" },
    complete: { file: "complete.mp3", originalName: "picked.mp3" },
  });
});

test("settings theme override actions import active theme overrides with the committed map", () => {
  const calls = [];
  const payload = {
    version: 1,
    themes: {
      "wang-pet": {
        states: {
          attention: { disabled: true },
        },
      },
    },
  };
  const snapshot = { theme: "wang-pet", themeOverrides: {} };

  const result = themeOverrideCommands.importAnimationOverrides(payload, {
    snapshot,
    activateTheme: (themeId, variantId, overrideMap) => {
      calls.push({ themeId, variantId, overrideMap });
    },
  });

  assert.strictEqual(result.status, "ok");
  assert.strictEqual(result.importedThemeCount, 1);
  assert.deepStrictEqual(calls, [
    {
      themeId: "wang-pet",
      variantId: null,
      overrideMap: result.commit.themeOverrides["wang-pet"],
    },
  ]);
});

test("settings theme override actions reset an active theme by reloading without overrides", () => {
  const calls = [];
  const snapshot = {
    theme: "wang-pet",
    themeOverrides: {
      "wang-pet": { states: { attention: { disabled: true } } },
      calico: { states: { error: { disabled: true } } },
    },
  };

  const result = themeOverrideCommands.resetThemeOverrides("wang-pet", {
    snapshot,
    activateTheme: (themeId, variantId, overrideMap) => {
      calls.push({ themeId, variantId, overrideMap });
    },
  });

  assert.strictEqual(result.status, "ok");
  assert.strictEqual(result.commit.themeOverrides["wang-pet"], undefined);
  assert.ok(result.commit.themeOverrides.calico);
  assert.deepStrictEqual(calls, [
    { themeId: "wang-pet", variantId: null, overrideMap: null },
  ]);
});
