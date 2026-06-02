"use strict";

// ── Pet token data source (mockable) ──
//
// Contract:
//   `fetchTokenTotal(): Promise<{ totalTokens: number, asOf: number }>`
//     - totalTokens: cumulative token count used to drive the pet leveling
//       system. Always a finite, non-negative integer.
//     - asOf: epoch-ms timestamp the figure was read at (Date.now()).
//
// This is the seam between WangPet and the "internal official data interface".
// For now the body is a MOCK; when the real internal API lands, its
// implementation is dropped into this same function and callers
// (pet-level-controller.js) stay UNCHANGED — they only depend on the returned
// shape, never on how the number was obtained.
//
// Mock behavior:
//   - Default: returns { totalTokens: 0, asOf: Date.now() }.
//   - Override via env var `WANGPET_MOCK_TOKEN_TOTAL` (parsed as an integer)
//     so level transitions can be exercised in manual testing.
//   - Robust to bad env values: anything that isn't a finite, >= 0 integer
//     falls back to 0.
//
// Dependency-free (Node built-ins only).

const MOCK_TOKEN_ENV = "WANGPET_MOCK_TOKEN_TOTAL";

// Parse the override env var into a usable token total. Returns 0 for unset,
// non-numeric, negative, non-finite, or otherwise malformed values.
function resolveMockTokenTotal() {
  const raw = process.env[MOCK_TOKEN_ENV];
  if (typeof raw !== "string" || raw.trim() === "") return 0;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

async function fetchTokenTotal() {
  return { totalTokens: resolveMockTokenTotal(), asOf: Date.now() };
}

module.exports = {
  fetchTokenTotal,
  MOCK_TOKEN_ENV,
};
