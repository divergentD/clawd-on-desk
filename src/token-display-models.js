"use strict";

(function exposeTokenDisplayModels(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.tokenDisplayModels = api;
})(typeof window !== "undefined" ? window : null, function createTokenDisplayModels() {
  function normalizeTokens(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
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
      const row = grouped.get(model) || { tokens: 0, iconUrl: session.iconUrl || null };
      row.tokens += tokens;
      if (!row.iconUrl && session.iconUrl) row.iconUrl = session.iconUrl;
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
      });
    }

    return { totalTokens, rows };
  }

  return { groupTokenUsage };
});
