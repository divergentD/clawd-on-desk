"use strict";

const assert = require("node:assert");
const test = require("node:test");
const { resolveModelProvider } = require("../src/model-provider-map");

test("maps brand model identifiers to provider keys", () => {
  const cases = {
    "claude-sonnet-4-5-20250929": "anthropic",
    "claude-3-7-haiku": "anthropic",
    "gpt-5": "openai",
    "gpt-4o-mini": "openai",
    "chatgpt-4o-latest": "openai",
    "o3-mini": "openai",
    "o1": "openai",
    "openai/o4-mini": "openai",
    "codex-mini-latest": "openai",
    "gemini-2.5-pro": "google",
    "gemma-3-27b": "google",
    "qwen3-coder": "qwen",
    "qwq-32b": "qwen",
    "kimi-k2": "moonshot",
    "moonshot-v1-128k": "moonshot",
    "deepseek-v3.2": "deepseek",
    "grok-4": "xai",
    "mistral-large-latest": "mistral",
    "codestral-2508": "mistral",
    "glm-4.6": "zhipu",
    "llama-3.3-70b": "meta",
  };
  for (const [model, provider] of Object.entries(cases)) {
    assert.strictEqual(resolveModelProvider(model), provider, `model: ${model}`);
  }
});

test("is case-insensitive and trims whitespace", () => {
  assert.strictEqual(resolveModelProvider("  Claude-Opus  "), "anthropic");
  assert.strictEqual(resolveModelProvider("GPT-5"), "openai");
});

test("returns null for unknown, empty, or non-string models", () => {
  assert.strictEqual(resolveModelProvider("some-unknown-model"), null);
  assert.strictEqual(resolveModelProvider(""), null);
  assert.strictEqual(resolveModelProvider("   "), null);
  assert.strictEqual(resolveModelProvider(null), null);
  assert.strictEqual(resolveModelProvider(undefined), null);
  assert.strictEqual(resolveModelProvider(42), null);
});

test("does not false-match the o-series inside arbitrary words", () => {
  assert.strictEqual(resolveModelProvider("modelo3000"), null);
  assert.strictEqual(resolveModelProvider("turbo1x"), null);
});
