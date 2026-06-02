"use strict";

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const { resolveModelProvider } = require("./model-provider-map");

// Provider logos sourced from models.dev (https://models.dev/logos/<provider>.svg) and
// re-colored into light/dark theme variants. See scripts/fetch-model-icons.js.
const MODEL_ICON_DIR = path.join(__dirname, "..", "assets", "icons", "models");
const _modelIconUrlCache = new Map();

function getModelIconPath(provider, { dark = false } = {}) {
  if (!provider || typeof provider !== "string") return null;
  if (!/^[a-z0-9._-]+$/i.test(provider)) return null;
  const fileName = dark ? `${provider}-dark.svg` : `${provider}.svg`;
  const iconPath = path.join(MODEL_ICON_DIR, fileName);
  return fs.existsSync(iconPath) ? iconPath : null;
}

function getModelIconUrl(model, { dark = false } = {}) {
  const provider = resolveModelProvider(model);
  if (!provider) return null;
  const cacheKey = `${provider}|${dark ? "dark" : "light"}`;
  if (_modelIconUrlCache.has(cacheKey)) return _modelIconUrlCache.get(cacheKey);
  const iconPath = getModelIconPath(provider, { dark });
  const iconUrl = iconPath ? pathToFileURL(iconPath).href : null;
  _modelIconUrlCache.set(cacheKey, iconUrl);
  return iconUrl;
}

module.exports = {
  MODEL_ICON_DIR,
  getModelIconPath,
  getModelIconUrl,
};
