"use strict";

const assert = require("node:assert");
const Module = require("node:module");
const test = require("node:test");
const { groupTokenUsage } = require("../src/token-display-models");

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
    x: 1716,
    y: 956,
    width: 196,
    height: 116,
  });
});

test("token display forwards model metadata to the renderer", () => {
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
  }), {
    sessions: [{
      id: "s1",
      agentId: "codex",
      iconUrl: "file:///codex.png",
      model: "gpt-5.4",
      inputTokens: 5,
      outputTokens: 2,
      totalCost: 0.01,
    }],
  });
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
      { model: "gpt-5.4", tokens: 16, iconUrl: "file:///codex.png" },
      { model: "claude-sonnet", tokens: 9, iconUrl: null },
      { model: "qwen", tokens: 6, iconUrl: null },
      { model: "other (2)", tokens: 8, iconUrl: null },
    ],
  });
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
  assert.strictEqual(created[0].options.y, 172);
});
