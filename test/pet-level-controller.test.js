"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const createPetLevelController = require("../src/pet-level-controller");
const { PET_LEVEL_CHANGE_CHANNEL } = require("../src/pet-level-controller");

// ── Test doubles ──

// Settings controller fake: mirrors the real get/applyCommand surface and
// mutates an in-memory store on a successful setPetLevel commit so multi-poll
// flows observe the persisted values.
function makeSettings(initial = {}) {
  const store = {
    petLevelEnabled: true,
    petLevel: 1,
    petLevelTokenTotal: 0,
    ...initial,
  };
  const commands = [];
  return {
    store,
    commands,
    get(key) {
      return store[key];
    },
    async applyCommand(name, payload) {
      commands.push({ name, payload });
      if (name === "setPetLevel") {
        store.petLevel = payload.petLevel;
        store.petLevelTokenTotal = payload.petLevelTokenTotal;
      }
      return { status: "ok" };
    },
  };
}

function makeThemeRuntime() {
  return {
    reloads: 0,
    reloadActiveTheme() {
      this.reloads += 1;
      return { themeId: "wang-pet", variantId: "default" };
    },
  };
}

function makeBroadcast() {
  const calls = [];
  const fn = (channel, payload) => calls.push({ channel, payload });
  fn.calls = calls;
  return fn;
}

function fixedSource(totalTokens) {
  return async () => ({ totalTokens, asOf: 1700000000000 });
}

// Timer injection: capture the interval handle without ever firing it, so the
// initial poll (awaited via start()) is the only cycle under test.
function makeTimers() {
  const created = [];
  return {
    created,
    setInterval(fn, ms) {
      const id = { fn, ms, cleared: false };
      created.push(id);
      return id;
    },
    clearInterval(id) {
      if (id) id.cleared = true;
    },
  };
}

function makeController(overrides = {}) {
  const settings = overrides.settings || makeSettings(overrides.initial);
  const theme = overrides.theme || makeThemeRuntime();
  const broadcast = overrides.broadcast || makeBroadcast();
  const timers = overrides.timers || makeTimers();
  const controller = createPetLevelController({
    fetchTokenTotal: overrides.fetchTokenTotal || fixedSource(overrides.totalTokens || 0),
    settingsController: settings,
    themeRuntime: theme,
    broadcast,
    intervalMs: 1000,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  });
  return { controller, settings, theme, broadcast, timers };
}

describe("pet-level-controller", () => {
  it("is a no-op when petLevelEnabled is false", async () => {
    let fetched = 0;
    const { controller, settings, theme, broadcast, timers } = makeController({
      initial: { petLevelEnabled: false },
      fetchTokenTotal: async () => {
        fetched += 1;
        return { totalTokens: 50_000_000, asOf: 1 };
      },
    });

    await controller.start();

    assert.equal(fetched, 0, "fetchTokenTotal must not be called when disabled");
    assert.equal(settings.commands.length, 0, "no commands persisted when disabled");
    assert.equal(theme.reloads, 0, "no skin reload when disabled");
    assert.equal(broadcast.calls.length, 0, "no broadcast when disabled");
    assert.equal(timers.created.length, 0, "no interval scheduled when disabled");
    assert.equal(controller.isRunning(), false);
  });

  it("persists the token total on the first poll (no level change)", async () => {
    // total 500 is below L2 (1_000_000) → level stays 1, but total changed.
    const { controller, settings, theme, broadcast } = makeController({
      initial: { petLevel: 1, petLevelTokenTotal: 0 },
      totalTokens: 500,
    });

    await controller.start();

    assert.equal(settings.commands.length, 1);
    assert.deepEqual(settings.commands[0], {
      name: "setPetLevel",
      payload: { petLevel: 1, petLevelTokenTotal: 500 },
    });
    assert.equal(theme.reloads, 0, "no reload when level unchanged");
    assert.equal(broadcast.calls.length, 0, "no broadcast when level unchanged");
    assert.equal(settings.store.petLevelTokenTotal, 500);
  });

  it("levels up: persists, reloads the skin, and broadcasts the payload", async () => {
    const { controller, settings, theme, broadcast } = makeController({
      initial: { petLevel: 1, petLevelTokenTotal: 0 },
      totalTokens: 1_000_000, // exactly L2 threshold
    });

    await controller.start();

    assert.equal(settings.commands.length, 1);
    assert.deepEqual(settings.commands[0].payload, {
      petLevel: 2,
      petLevelTokenTotal: 1_000_000,
    });
    assert.equal(theme.reloads, 1, "level change forces exactly one skin reload");
    assert.equal(broadcast.calls.length, 1, "level change broadcasts once");
    assert.equal(broadcast.calls[0].channel, PET_LEVEL_CHANGE_CHANNEL);
    assert.deepEqual(broadcast.calls[0].payload, {
      level: 2,
      previousLevel: 1,
      totalTokens: 1_000_000,
      nextThreshold: 10_000_000,
    });
  });

  it("broadcasts a null nextThreshold at max level", async () => {
    const { controller, broadcast } = makeController({
      initial: { petLevel: 1, petLevelTokenTotal: 0 },
      totalTokens: 50_000_000, // L4 (max)
    });

    await controller.start();

    assert.equal(broadcast.calls.length, 1);
    assert.equal(broadcast.calls[0].payload.level, 4);
    assert.equal(broadcast.calls[0].payload.nextThreshold, null);
  });

  it("never downgrades on a transient source reset", async () => {
    // Stored at L3 with a big total; source resets to 0.
    const { controller, settings, theme, broadcast } = makeController({
      initial: { petLevel: 3, petLevelTokenTotal: 10_000_000 },
      totalTokens: 0,
    });

    await controller.start();

    // Total changed (10_000_000 → 0) so it persists, but the LEVEL is held at 3.
    assert.equal(settings.commands.length, 1);
    assert.deepEqual(settings.commands[0].payload, {
      petLevel: 3,
      petLevelTokenTotal: 0,
    });
    assert.equal(settings.store.petLevel, 3, "level must not drop below stored");
    assert.equal(theme.reloads, 0, "no reload — level unchanged");
    assert.equal(broadcast.calls.length, 0, "no broadcast — level unchanged");
  });

  it("persists a token-total bump without reload/broadcast when level is unchanged", async () => {
    // Stored L2 at 1_000_000; new total 2_000_000 is still below L3 (10_000_000).
    const { controller, settings, theme, broadcast } = makeController({
      initial: { petLevel: 2, petLevelTokenTotal: 1_000_000 },
      totalTokens: 2_000_000,
    });

    await controller.start();

    assert.equal(settings.commands.length, 1);
    assert.deepEqual(settings.commands[0].payload, {
      petLevel: 2,
      petLevelTokenTotal: 2_000_000,
    });
    assert.equal(theme.reloads, 0);
    assert.equal(broadcast.calls.length, 0);
  });

  it("does nothing to persist when neither level nor total changed", async () => {
    const { controller, settings, theme, broadcast } = makeController({
      initial: { petLevel: 2, petLevelTokenTotal: 5_000_000 },
      totalTokens: 5_000_000,
    });

    await controller.start();

    assert.equal(settings.commands.length, 0, "no command when nothing changed");
    assert.equal(theme.reloads, 0);
    assert.equal(broadcast.calls.length, 0);
  });

  it("skips reload + broadcast if the persist command is rejected", async () => {
    const settings = makeSettings({ petLevel: 1, petLevelTokenTotal: 0 });
    settings.applyCommand = async (name, payload) => {
      settings.commands.push({ name, payload });
      return { status: "error", message: "boom" };
    };
    const { controller, theme, broadcast } = makeController({
      settings,
      totalTokens: 1_000_000, // would be a level-up
    });

    await controller.start();

    assert.equal(settings.commands.length, 1, "persist was attempted");
    assert.equal(theme.reloads, 0, "no reload when persist failed");
    assert.equal(broadcast.calls.length, 0, "no broadcast when persist failed");
  });

  it("schedules an interval on start and clears it on stop", async () => {
    const { controller, timers } = makeController({ totalTokens: 0 });

    await controller.start();
    assert.equal(timers.created.length, 1, "one interval scheduled");
    assert.equal(controller.isRunning(), true);

    controller.stop();
    assert.equal(timers.created[0].cleared, true, "interval cleared on stop");
    assert.equal(controller.isRunning(), false);
  });

  it("survives a fetchTokenTotal rejection without throwing", async () => {
    const { controller, settings, theme, broadcast } = makeController({
      fetchTokenTotal: async () => {
        throw new Error("source offline");
      },
    });

    await controller.start(); // must resolve, not reject

    assert.equal(settings.commands.length, 0);
    assert.equal(theme.reloads, 0);
    assert.equal(broadcast.calls.length, 0);
  });

  it("survives a malformed token payload (non-finite total)", async () => {
    // total NaN normalizes to 0 → level 1, no change from defaults.
    const { controller, settings } = makeController({
      initial: { petLevel: 1, petLevelTokenTotal: 0 },
      fetchTokenTotal: async () => ({ totalTokens: NaN, asOf: 1 }),
    });

    await controller.start();
    assert.equal(settings.commands.length, 0);
  });
});
