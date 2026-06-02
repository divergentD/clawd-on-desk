"use strict";

const assert = require("node:assert");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { getModelIconUrl, getModelIconPath, MODEL_ICON_DIR } = require("../src/state-model-icons");

test("resolves a bundled provider logo to a light/dark file URL", () => {
  const light = getModelIconUrl("claude-sonnet-4-5");
  const dark = getModelIconUrl("claude-sonnet-4-5", { dark: true });
  assert.strictEqual(light, pathToFileURL(path.join(MODEL_ICON_DIR, "anthropic.svg")).href);
  assert.strictEqual(dark, pathToFileURL(path.join(MODEL_ICON_DIR, "anthropic-dark.svg")).href);
});

test("returns null for models without a provider match", () => {
  assert.strictEqual(getModelIconUrl("some-unknown-model"), null);
  assert.strictEqual(getModelIconUrl(""), null);
  assert.strictEqual(getModelIconUrl(null), null);
});

test("returns null for providers without a bundled asset", () => {
  // meta/llama has no models.dev logo, so the asset is intentionally absent.
  assert.strictEqual(getModelIconUrl("llama-3.3-70b"), null);
});

test("getModelIconPath rejects unsafe provider names", () => {
  assert.strictEqual(getModelIconPath("../secret"), null);
  assert.strictEqual(getModelIconPath(""), null);
  assert.strictEqual(getModelIconPath(null), null);
});
