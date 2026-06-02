"use strict";

(function exposeTokenDisplayModels(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.tokenDisplayModels = api;
})(typeof window !== "undefined" ? window : null, function createTokenDisplayModels() {
  function normalizeTokens(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function pickSessionIcon(session) {
    if (session.modelIconUrl) {
      return {
        iconUrl: session.modelIconUrl,
        iconUrlDark: session.modelIconUrlDark || session.modelIconUrl,
      };
    }
    if (session.iconUrl) {
      // Agent icon has no theme variant; use the same image for both.
      return { iconUrl: session.iconUrl, iconUrlDark: session.iconUrl };
    }
    return { iconUrl: null, iconUrlDark: null };
  }

  function groupTokenUsage(sessions, maxVisibleModels = 4) {
    const grouped = new Map();
    let totalTokens = 0;

    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
      const tokens = normalizeTokens(session.inputTokens) + normalizeTokens(session.outputTokens);
      if (!tokens) return;
      const model = typeof session.model === "string" && session.model.trim()
        ? session.model.trim()
        : "unknown";
      // Prefer the model provider logo (themed light/dark); fall back to the reporting
      // agent icon (single variant), and finally to a colored dot in the renderer.
      const icon = pickSessionIcon(session);
      const row = grouped.get(model) || { tokens: 0, iconUrl: icon.iconUrl, iconUrlDark: icon.iconUrlDark };
      row.tokens += tokens;
      if (!row.iconUrl && icon.iconUrl) {
        row.iconUrl = icon.iconUrl;
        row.iconUrlDark = icon.iconUrlDark;
      }
      grouped.set(model, row);
      totalTokens += tokens;
    });

    const rows = Array.from(grouped.entries())
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([model, row]) => ({ model, ...row }));
    if (rows.length > maxVisibleModels) {
      const hidden = rows.splice(maxVisibleModels - 1);
      rows.push({
        model: `other (${hidden.length})`,
        tokens: hidden.reduce((sum, row) => sum + row.tokens, 0),
        iconUrl: null,
        iconUrlDark: null,
      });
    }

    return { totalTokens, rows };
  }

  return { groupTokenUsage };
});
