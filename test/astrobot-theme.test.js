"use strict";

const assert = require("assert");
const path = require("path");
const test = require("node:test");

const themeLoader = require("../src/theme-loader");

const ROOT = path.join(__dirname, "..");
themeLoader.init(path.join(ROOT, "src"));

test("built-in Codex Pet Astronaut theme loads with static fallbacks", () => {
  const theme = themeLoader.loadTheme("codex-pet-astronaut-v1", { strict: true });
  const resourceErrors = themeLoader._validateRequiredAssets(theme);

  assert.deepStrictEqual(resourceErrors, []);
  assert.strictEqual(theme._id, "codex-pet-astronaut-v1");
  assert.strictEqual(theme.name, "Codex Pet Astronaut");
  assert.strictEqual(theme.eyeTracking.enabled, false);
  assert.strictEqual(theme.miniMode.supported, false);
  assert.deepStrictEqual(theme.states.working, ["coding.png"]);
  assert.deepStrictEqual(theme.states.attention, ["success.png"]);
});
