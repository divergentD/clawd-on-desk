"use strict";

const assert = require("node:assert");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

async function loadPlugin() {
  const pluginPath = path.join(__dirname, "..", "hooks", "opencode-plugin", "token-usage.mjs");
  return import(`${pathToFileURL(pluginPath).href}?token-usage-test=${Date.now()}`);
}

function messageUpdated(overrides = {}) {
  return {
    type: "message.updated",
    properties: {
      info: {
        id: "msg-1",
        sessionID: "ses-1",
        role: "assistant",
        modelID: "kimi-k2.6",
        providerID: "moonshot",
        cost: 0.02,
        tokens: { input: 10, output: 4 },
        ...overrides,
      },
    },
  };
}

test("opencode plugin accumulates assistant message usage without double-counting streaming snapshots", async () => {
  const plugin = await loadPlugin();
  const sessions = new Map();

  assert.deepStrictEqual(plugin.accumulateAssistantUsage(messageUpdated(), sessions), {
    sessionId: "ses-1",
    model: "kimi-k2.6",
    provider: "moonshot",
    inputTokens: 10,
    outputTokens: 4,
    totalCost: 0.02,
  });

  assert.deepStrictEqual(plugin.accumulateAssistantUsage(messageUpdated({
    tokens: { input: 12, output: 7 },
    cost: 0.03,
  }), sessions), {
    sessionId: "ses-1",
    model: "kimi-k2.6",
    provider: "moonshot",
    inputTokens: 12,
    outputTokens: 7,
    totalCost: 0.03,
  });

  assert.deepStrictEqual(plugin.accumulateAssistantUsage(messageUpdated({
    id: "msg-2",
    tokens: { input: 6, output: 3 },
    cost: 0.01,
  }), sessions), {
    sessionId: "ses-1",
    model: "kimi-k2.6",
    provider: "moonshot",
    inputTokens: 18,
    outputTokens: 10,
    totalCost: 0.04,
  });
});
