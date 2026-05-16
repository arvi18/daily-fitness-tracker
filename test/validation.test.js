import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidDate, validateDailyLog, validateGoals } from "../lib/validation.js";

describe("isValidDate", () => {
  it("accepts YYYY-MM-DD", () => {
    assert.equal(isValidDate("2026-05-15"), true);
  });

  it("rejects invalid formats", () => {
    assert.equal(isValidDate("15-05-2026"), false);
    assert.equal(isValidDate("2026/05/15"), false);
  });
});

describe("validateDailyLog", () => {
  const valid = {
    date: "2026-05-15",
    diet_summary: "eggs and rice",
    intake_kcal: 2000,
    protein_g: 120,
    steps: 10000,
    burn_kcal: 2500,
    net_diff: -500,
  };

  it("accepts a valid payload", () => {
    assert.equal(validateDailyLog(valid), null);
  });

  it("requires net_diff to match intake minus burn", () => {
    assert.match(validateDailyLog({ ...valid, net_diff: 0 }), /net_diff/);
  });

});

describe("validateGoals", () => {
  it("accepts valid goals", () => {
    assert.equal(
      validateGoals({
        steps_target: 10000,
        protein_g_target: 100,
        intake_kcal_max: 2200,
        net_diff_target: -300,
      }),
      null
    );
  });
});
