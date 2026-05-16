import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeeklySummary,
  computeStreaks,
  evaluateProgress,
  rowToGoals,
} from "../lib/progress.js";

const goals = rowToGoals({
  steps_target: 10000,
  protein_g_target: 100,
  intake_kcal_max: 2200,
  net_diff_target: -300,
  water_ml_target: 2500,
});

const sampleLog = {
  date: "2026-05-15",
  diet_summary: "balanced",
  intake_kcal: 2000,
  protein_g: 110,
  steps: 12000,
  burn_kcal: 2600,
  net_diff: -600,
  water_ml: 2600,
};

describe("evaluateProgress", () => {
  it("marks metrics met when log beats goals", () => {
    const { score, metrics } = evaluateProgress(sampleLog, goals);
    assert.equal(score.met, score.total);
    assert.ok(metrics.every((m) => m.met));
  });

  it("returns guidance when no log exists", () => {
    const { score, messages } = evaluateProgress(null, goals);
    assert.equal(score.met, 0);
    assert.ok(messages.length > 0);
  });
});

describe("computeStreaks", () => {
  it("counts consecutive logging days", () => {
    const logs = ["2026-05-13", "2026-05-14", "2026-05-15"].map((date) => ({
      ...sampleLog,
      date,
    }));
    const streaks = computeStreaks(logs, goals, "2026-05-15");
    assert.equal(streaks.logging, 3);
  });
});

describe("buildWeeklySummary", () => {
  it("returns seven days in range", () => {
    const summary = buildWeeklySummary(
      [{ ...sampleLog, date: "2026-05-15" }],
      goals,
      "2026-05-15"
    );
    assert.equal(summary.days.length, 7);
    assert.equal(summary.end, "2026-05-15");
  });
});
