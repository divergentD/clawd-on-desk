"use strict";

// Maps a raw model identifier reported by an agent (e.g. "claude-sonnet-4-5-20250929",
// "gpt-5", "gemini-2.5-pro", "qwen3-coder", "o3-mini") to a provider key. Provider keys
// drive which bundled logo (assets/icons/models/<provider>.svg) gets shown in the token
// display. Matching is intentionally coarse (brand/provider level) so new model versions
// inherit the right logo without per-model maintenance.

function hasOpenAiSeries(value) {
  // gpt / chatgpt / codex / davinci are safe substrings; the o-series (o1/o3/o4) needs a
  // boundary so it does not false-match arbitrary strings that merely contain "o3".
  if (value.includes("gpt") || value.includes("codex") || value.includes("davinci")) {
    return true;
  }
  return /(?:^|[^a-z0-9])o[134](?:[^a-z0-9]|$)/.test(value);
}

// Ordered so the most specific brands win first.
const RULES = [
  { provider: "anthropic", test: (v) => v.includes("claude") },
  { provider: "openai", test: hasOpenAiSeries },
  { provider: "google", test: (v) => /gemini|gemma|palm|bison/.test(v) },
  { provider: "qwen", test: (v) => /qwen|qwq|tongyi/.test(v) },
  { provider: "moonshot", test: (v) => /kimi|moonshot/.test(v) },
  { provider: "deepseek", test: (v) => v.includes("deepseek") },
  { provider: "xai", test: (v) => v.includes("grok") },
  { provider: "mistral", test: (v) => /mistral|mixtral|codestral|ministral|magistral|pixtral/.test(v) },
  { provider: "zhipu", test: (v) => /glm|chatglm|zhipu/.test(v) },
  { provider: "meta", test: (v) => /llama|meta-/.test(v) },
];

function resolveModelProvider(model) {
  if (typeof model !== "string") return null;
  const value = model.trim().toLowerCase();
  if (!value) return null;
  for (const rule of RULES) {
    if (rule.test(value)) return rule.provider;
  }
  return null;
}

module.exports = { resolveModelProvider };
