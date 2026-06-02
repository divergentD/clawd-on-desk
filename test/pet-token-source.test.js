"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const { fetchTokenTotal, MOCK_TOKEN_ENV } = require("../src/pet-token-source");

let savedEnv;

beforeEach(() => {
  savedEnv = process.env[MOCK_TOKEN_ENV];
  delete process.env[MOCK_TOKEN_ENV];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[MOCK_TOKEN_ENV];
  else process.env[MOCK_TOKEN_ENV] = savedEnv;
});

describe("pet-token-source.fetchTokenTotal", () => {
  it("returns the documented shape", async () => {
    const before = Date.now();
    const result = await fetchTokenTotal();
    const after = Date.now();
    assert.strictEqual(typeof result, "object");
    assert.strictEqual(typeof result.totalTokens, "number");
    assert.strictEqual(typeof result.asOf, "number");
    assert.ok(result.asOf >= before && result.asOf <= after, "asOf should be a current timestamp");
  });

  it("defaults to 0 tokens when no env override is set", async () => {
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 0);
  });

  it("honors a valid integer env override", async () => {
    process.env[MOCK_TOKEN_ENV] = "12345678";
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 12345678);
  });

  it("parses leading-integer values (parseInt semantics)", async () => {
    process.env[MOCK_TOKEN_ENV] = "  9000  ";
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 9000);
  });

  it("falls back to 0 for non-numeric env values", async () => {
    process.env[MOCK_TOKEN_ENV] = "not-a-number";
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 0);
  });

  it("falls back to 0 for negative env values", async () => {
    process.env[MOCK_TOKEN_ENV] = "-500";
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 0);
  });

  it("falls back to 0 for an empty / whitespace env value", async () => {
    process.env[MOCK_TOKEN_ENV] = "   ";
    const result = await fetchTokenTotal();
    assert.strictEqual(result.totalTokens, 0);
  });
});
