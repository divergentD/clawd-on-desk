"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  LEVEL_THRESHOLDS,
  MIN_LEVEL,
  MAX_LEVEL,
  computeExperience,
  computeLevel,
  computeLevelFromExperience,
  nextThreshold,
} = require("../src/pet-level");

describe("pet-level.LEVEL_THRESHOLDS", () => {
  it("uses harder experience thresholds (L1=0, L2=1e8, L3=1e9, L4=5e9)", () => {
    assert.strictEqual(LEVEL_THRESHOLDS[1], 0);
    assert.strictEqual(LEVEL_THRESHOLDS[2], 100_000_000);
    assert.strictEqual(LEVEL_THRESHOLDS[3], 1_000_000_000);
    assert.strictEqual(LEVEL_THRESHOLDS[4], 5_000_000_000);
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

describe("pet-level.computeExperience", () => {
  it("converts token totals into upgrade experience through a dedicated interface", () => {
    assert.strictEqual(computeExperience({ totalTokens: 123 }), 123);
  });

  it("accepts additional experience sources for future non-token mechanics", () => {
    assert.strictEqual(computeExperience({
      totalTokens: 100,
      bonusExperience: 25,
      sources: [
        { id: "daily-streak", experience: 10 },
        { id: "achievement", experience: 15.8 },
      ],
    }), 150);
  });

  it("ignores malformed or negative experience inputs", () => {
    assert.strictEqual(computeExperience({
      totalTokens: -100,
      bonusExperience: -25,
      sources: [
        { id: "bad", experience: NaN },
        { id: "also-bad", experience: -10 },
      ],
    }), 0);
  });
});

describe("pet-level.computeLevel", () => {
  it("returns level 1 at zero tokens", () => {
    assert.strictEqual(computeLevel(0), 1);
  });

  it("returns level 1 just below the L2 boundary", () => {
    assert.strictEqual(computeLevel(99_999_999), 1);
  });

  it("promotes to the higher level exactly at a boundary", () => {
    assert.strictEqual(computeLevel(100_000_000), 2);
    assert.strictEqual(computeLevel(1_000_000_000), 3);
    assert.strictEqual(computeLevel(5_000_000_000), 4);
  });

  it("can compute level directly from accumulated experience", () => {
    assert.strictEqual(computeLevelFromExperience(100_000_000), 2);
    assert.strictEqual(computeLevelFromExperience(1_000_000_000), 3);
    assert.strictEqual(computeLevelFromExperience(5_000_000_000), 4);
  });

  it("returns intermediate levels for in-between totals", () => {
    assert.strictEqual(computeLevel(500_000_000), 2);
    assert.strictEqual(computeLevel(2_500_000_000), 3);
  });

  it("clamps to max level 4 for huge totals", () => {
    assert.strictEqual(computeLevel(10_000_000_000), 4);
    assert.strictEqual(computeLevel(Number.MAX_SAFE_INTEGER), 4);
  });

  it("treats negative totals as level 1", () => {
    assert.strictEqual(computeLevel(-1), 1);
    assert.strictEqual(computeLevel(-5_000_000_000), 1);
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
    for (const total of [0, 50_000_000, 100_000_000, 999_999_999, 1_000_000_000, 4_999_999_999, 5_000_000_000, 1e12]) {
      const level = computeLevel(total);
      assert.ok(level >= prev, `level should not decrease at total=${total}`);
      prev = level;
    }
  });
});

describe("pet-level.nextThreshold", () => {
  it("returns the next level's requirement for levels 1..3", () => {
    assert.strictEqual(nextThreshold(1), 100_000_000);
    assert.strictEqual(nextThreshold(2), 1_000_000_000);
    assert.strictEqual(nextThreshold(3), 5_000_000_000);
  });

  it("returns null at the max level", () => {
    assert.strictEqual(nextThreshold(4), null);
  });

  it("clamps below-min levels up to 1", () => {
    assert.strictEqual(nextThreshold(0), 100_000_000);
    assert.strictEqual(nextThreshold(-5), 100_000_000);
  });

  it("returns null for levels above max", () => {
    assert.strictEqual(nextThreshold(5), null);
    assert.strictEqual(nextThreshold(100), null);
  });

  it("floors fractional levels before lookup", () => {
    assert.strictEqual(nextThreshold(1.9), 100_000_000);
    assert.strictEqual(nextThreshold(3.2), 5_000_000_000);
  });

  it("falls back to level 1 for non-finite input", () => {
    assert.strictEqual(nextThreshold(NaN), 100_000_000);
    assert.strictEqual(nextThreshold(Infinity), 100_000_000);
    assert.strictEqual(nextThreshold(undefined), 100_000_000);
  });
});
