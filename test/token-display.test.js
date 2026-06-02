"use strict";

const assert = require("node:assert");
const Module = require("node:module");
const test = require("node:test");
const { groupTokenUsage } = require("../src/token-display-models");
const { getModelIconUrl } = require("../src/state-model-icons");

function loadTokenDisplay(BrowserWindow) {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === "electron") return { BrowserWindow };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve("../src/token-display")];
    return require("../src/token-display");
  } finally {
    Module._load = originalLoad;
  }
}

test("token display bounds clamp to the selected work area", () => {
  const initTokenDisplay = loadTokenDisplay(function BrowserWindow() {});
  assert.deepStrictEqual(initTokenDisplay.computeTokenDisplayBounds({
    petHitRect: { left: 1900, top: 1060, right: 1980, bottom: 1140 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  }), {
    x: 1684,
    y: 920,
    width: 228,
    height: 152,
  });
});

test("token display forwards model metadata and resolves provider logos", () => {
  const initTokenDisplay = loadTokenDisplay(function BrowserWindow() {});
  assert.deepStrictEqual(initTokenDisplay.buildTokenData({
    sessions: [{
      id: "s1",
      agentId: "codex",
      iconUrl: "file:///codex.png",
      model: "gpt-5.4",
      inputTokens: 5,
      outputTokens: 2,
      totalCost: 0.01,
    }],
  }, {
    petLevel: 3,
    petLevelTokenTotal: 1_200_000_000,
    petLevelEnabled: true,
  }), {
    petLevel: {
      enabled: true,
      level: 3,
      maxLevel: 4,
      experience: 1_200_000_000,
      currentThreshold: 1_000_000_000,
      nextThreshold: 5_000_000_000,
      progress: 0.05,
      remainingExperience: 3_800_000_000,
    },
    sessions: [{
      id: "s1",
      agentId: "codex",
      iconUrl: "file:///codex.png",
      modelIconUrl: getModelIconUrl("gpt-5.4", { dark: false }),
      modelIconUrlDark: getModelIconUrl("gpt-5.4", { dark: true }),
      model: "gpt-5.4",
      inputTokens: 5,
      outputTokens: 2,
      totalCost: 0.01,
    }],
  });
});

test("token display omits pet level data when leveling is disabled", () => {
  const initTokenDisplay = loadTokenDisplay(function BrowserWindow() {});
  const data = initTokenDisplay.buildTokenData({ sessions: [] }, {
    petLevel: 2,
    petLevelTokenTotal: 100_000_000,
    petLevelEnabled: false,
  });
  assert.strictEqual(data.petLevel.enabled, false);
});

test("token display groups usage by model and folds overflow into other", () => {
  assert.deepStrictEqual(groupTokenUsage([
    { model: "gpt-5.4", iconUrl: "file:///codex.png", inputTokens: 10, outputTokens: 2 },
    { model: "gpt-5.4", inputTokens: 3, outputTokens: 1 },
    { model: "claude-sonnet", inputTokens: 8, outputTokens: 1 },
    { model: "qwen", inputTokens: 5, outputTokens: 1 },
    { model: "kimi", inputTokens: 4, outputTokens: 1 },
    { inputTokens: 2, outputTokens: 1 },
  ]), {
    totalTokens: 39,
    rows: [
      { model: "gpt-5.4", tokens: 16, iconUrl: "file:///codex.png", iconUrlDark: "file:///codex.png" },
      { model: "claude-sonnet", tokens: 9, iconUrl: null, iconUrlDark: null },
      { model: "qwen", tokens: 6, iconUrl: null, iconUrlDark: null },
      { model: "other (2)", tokens: 8, iconUrl: null, iconUrlDark: null },
    ],
  });
});

test("token display prefers the model provider logo and its dark variant", () => {
  const { rows } = groupTokenUsage([
    {
      model: "claude-sonnet-4-5",
      iconUrl: "file:///agent.png",
      modelIconUrl: "file:///models/anthropic.svg",
      modelIconUrlDark: "file:///models/anthropic-dark.svg",
      inputTokens: 10,
      outputTokens: 0,
    },
  ]);
  assert.deepStrictEqual(rows, [{
    model: "claude-sonnet-4-5",
    tokens: 10,
    iconUrl: "file:///models/anthropic.svg",
    iconUrlDark: "file:///models/anthropic-dark.svg",
  }]);
});

test("token display falls back to the agent icon when no model logo exists", () => {
  const { rows } = groupTokenUsage([
    {
      model: "llama-3-70b",
      iconUrl: "file:///agent.png",
      modelIconUrl: null,
      modelIconUrlDark: null,
      inputTokens: 4,
      outputTokens: 0,
    },
  ]);
  assert.deepStrictEqual(rows, [{
    model: "llama-3-70b",
    tokens: 4,
    iconUrl: "file:///agent.png",
    iconUrlDark: "file:///agent.png",
  }]);
});

test("token display forwards the pet center and respects visibility policy", () => {
  const created = [];
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.webContents = {
        isLoading: () => true,
        on: () => {},
      };
      created.push(this);
    }
    isDestroyed() { return false; }
    loadFile() {}
    setVisibleOnAllWorkspaces() {}
    once() {}
    hide() {}
    show() {}
  }
  const initTokenDisplay = loadTokenDisplay(BrowserWindow);
  const workAreaCalls = [];
  const ctx = {
    tokenDisplayEnabled: false,
    mouseOverPet: false,
    petHidden: false,
    getMiniMode: () => false,
    getMiniTransitioning: () => false,
    getPetWindowBounds: () => ({ x: 100, y: 200, width: 80, height: 60 }),
    getHitRectScreen: () => ({ left: 115, top: 210, right: 155, bottom: 250 }),
    getNearestWorkArea: (...args) => {
      workAreaCalls.push(args);
      return { x: 0, y: 0, width: 1920, height: 1080 };
    },
  };
  const display = initTokenDisplay(ctx);
  display.sendSnapshot({ sessions: [{ inputTokens: 5, outputTokens: 2 }] });
  assert.strictEqual(created.length, 0);

  ctx.tokenDisplayEnabled = true;
  display.syncVisibility();
  assert.strictEqual(created.length, 0);

  ctx.mouseOverPet = true;
  display.syncVisibility();
  assert.strictEqual(created.length, 1);
  assert.deepStrictEqual(workAreaCalls, [[140, 230]]);
  assert.strictEqual(created[0].options.x, 161);
  assert.strictEqual(created[0].options.y, 154);
});

test("token display can show the pet level dashboard without live token rows", () => {
  const created = [];
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.webContents = {
        isLoading: () => true,
        on: () => {},
      };
      created.push(this);
    }
    isDestroyed() { return false; }
    loadFile() {}
    setVisibleOnAllWorkspaces() {}
    once() {}
    hide() {}
    show() {}
  }
  const initTokenDisplay = loadTokenDisplay(BrowserWindow);
  const ctx = {
    tokenDisplayEnabled: true,
    mouseOverPet: true,
    petHidden: false,
    getMiniMode: () => false,
    getMiniTransitioning: () => false,
    getPetWindowBounds: () => ({ x: 100, y: 200, width: 80, height: 60 }),
    getHitRectScreen: () => ({ left: 115, top: 210, right: 155, bottom: 250 }),
    getNearestWorkArea: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
    getSettingsSnapshot: () => ({
      petLevelEnabled: true,
      petLevel: 2,
      petLevelTokenTotal: 100_000_000,
    }),
  };
  const display = initTokenDisplay(ctx);
  display.sendSnapshot({ sessions: [] });
  assert.strictEqual(created.length, 1);
});
