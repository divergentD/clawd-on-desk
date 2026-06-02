"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  LEVEL_THRESHOLDS,
  MIN_LEVEL,
  MAX_LEVEL,
  computeLevel,
  nextThreshold,
} = require("../src/pet-level");

describe("pet-level.LEVEL_THRESHOLDS", () => {
  it("uses the placeholder defaults (L1=0, L2=1e6, L3=1e7, L4=5e7)", () => {
    assert.strictEqual(LEVEL_THRESHOLDS[1], 0);
    assert.strictEqual(LEVEL_THRESHOLDS[2], 1_000_000);
    assert.strictEqual(LEVEL_THRESHOLDS[3], 10_000_000);
    assert.strictEqual(LEVEL_THRESHOLDS[4], 50_000_000);
  });

  it("is monotonically non-decreasing across levels 1..4", () => {
    for (let lvl = MIN_LEVEL + 1; lvl <= MAX_LEVEL; lvl++) {
      assert.ok(
        LEVEL_THRESHOLDS[lvl] >= LEVEL_THRESHOLDS[lvl - 1],
        `threshold[${lvl}] should be >= threshold[${lvl - 1}]`
      );
    }
  });
});

describe("pet-level.computeLevel", () => {
  it("returns level 1 at zero tokens", () => {
    assert.strictEqual(computeLevel(0), 1);
  });

  it("returns level 1 just below the L2 boundary", () => {
    assert.strictEqual(computeLevel(999_999), 1);
  });

  it("promotes to the higher level exactly at a boundary", () => {
    assert.strictEqual(computeLevel(1_000_000), 2);
    assert.strictEqual(computeLevel(10_000_000), 3);
    assert.strictEqual(computeLevel(50_000_000), 4);
  });

  it("returns intermediate levels for in-between totals", () => {
    assert.strictEqual(computeLevel(5_000_000), 2);
    assert.strictEqual(computeLevel(25_000_000), 3);
  });

  it("clamps to max level 4 for huge totals", () => {
    assert.strictEqual(computeLevel(1_000_000_000), 4);
    assert.strictEqual(computeLevel(Number.MAX_SAFE_INTEGER), 4);
  });

  it("treats negative totals as level 1", () => {
    assert.strictEqual(computeLevel(-1), 1);
    assert.strictEqual(computeLevel(-50_000_000), 1);
  });

  it("treats non-finite / non-number input as level 1", () => {
    assert.strictEqual(computeLevel(NaN), 1);
    assert.strictEqual(computeLevel(Infinity), 1);
    assert.strictEqual(computeLevel(-Infinity), 1);
    assert.strictEqual(computeLevel("100"), 1);
    assert.strictEqual(computeLevel(null), 1);
    assert.strictEqual(computeLevel(undefined), 1);
    assert.strictEqual(computeLevel({}), 1);
  });

  it("is monotonically non-decreasing as tokens increase", () => {
    let prev = 0;
    for (const total of [0, 500_000, 1_000_000, 9_999_999, 10_000_000, 49_999_999, 50_000_000, 1e12]) {
      const level = computeLevel(total);
      assert.ok(level >= prev, `level should not decrease at total=${total}`);
      prev = level;
    }
  });
});

describe("pet-level.nextThreshold", () => {
  it("returns the next level's requirement for levels 1..3", () => {
    assert.strictEqual(nextThreshold(1), 1_000_000);
    assert.strictEqual(nextThreshold(2), 10_000_000);
    assert.strictEqual(nextThreshold(3), 50_000_000);
  });

  it("returns null at the max level", () => {
    assert.strictEqual(nextThreshold(4), null);
  });

  it("clamps below-min levels up to 1", () => {
    assert.strictEqual(nextThreshold(0), 1_000_000);
    assert.strictEqual(nextThreshold(-5), 1_000_000);
  });

  it("returns null for levels above max", () => {
    assert.strictEqual(nextThreshold(5), null);
    assert.strictEqual(nextThreshold(100), null);
  });

  it("floors fractional levels before lookup", () => {
    assert.strictEqual(nextThreshold(1.9), 1_000_000);
    assert.strictEqual(nextThreshold(3.2), 50_000_000);
  });

  it("falls back to level 1 for non-finite input", () => {
    assert.strictEqual(nextThreshold(NaN), 1_000_000);
    assert.strictEqual(nextThreshold(Infinity), 1_000_000);
    assert.strictEqual(nextThreshold(undefined), 1_000_000);
  });
});
