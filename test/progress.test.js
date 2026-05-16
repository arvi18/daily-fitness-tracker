import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyProgress,
  buildPeriodComparison,
  buildWeeklyProgress,
  buildWeeklySummary,
  computeStreaks,
  evaluateProgress,
  percentChange,
  rowToGoals,
} from "../lib/progress.js";

const goals = rowToGoals({
  steps_target: 10000,
  protein_g_target: 100,
  intake_kcal_max: 2200,
  net_diff_target: -300,
});

const sampleLog = {
  date: "2026-05-15",
  diet_summary: "balanced",
  intake_kcal: 2000,
  protein_g: 110,
  steps: 12000,
  burn_kcal: 2600,
  net_diff: -600,
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

describe("buildWeeklyProgress", () => {
  it("summarizes logged days in the week", () => {
    const progress = buildWeeklyProgress(
      [{ ...sampleLog, date: "2026-05-15" }],
      goals,
      "2026-05-15"
    );
    assert.equal(progress.period, "week");
    assert.equal(progress.totals.days_logged, 1);
    assert.ok(progress.metrics.length > 0);
  });

  it("includes comparison when previous week has logs", () => {
    const logs = [
      { ...sampleLog, date: "2026-05-08", steps: 8000 },
      { ...sampleLog, date: "2026-05-15", steps: 12000 },
    ];
    const progress = buildWeeklyProgress(logs, goals, "2026-05-15");
    assert.ok(progress.comparison);
    assert.equal(progress.comparison.previous_label, "last week");
    const stepsCmp = progress.comparison.metrics.find((m) => m.key === "steps");
    assert.ok(stepsCmp.change_pct > 0);
  });

  it("omits comparison when previous week has no logs", () => {
    const progress = buildWeeklyProgress(
      [{ ...sampleLog, date: "2026-05-15" }],
      goals,
      "2026-05-15"
    );
    assert.equal(progress.comparison, undefined);
  });
});

describe("percentChange", () => {
  it("returns null when previous value is zero and current is not", () => {
    assert.equal(percentChange(100, 0), null);
  });
});

describe("buildPeriodComparison", () => {
  it("returns null without previous logs", () => {
    const current = buildWeeklyProgress([{ ...sampleLog, date: "2026-05-15" }], goals, "2026-05-15");
    const previous = buildWeeklyProgress([], goals, "2026-05-08");
    assert.equal(buildPeriodComparison(current, previous, "week"), null);
  });
});

describe("buildMonthlyProgress", () => {
  it("covers the calendar month", () => {
    const progress = buildMonthlyProgress(
      [{ ...sampleLog, date: "2026-05-15" }],
      goals,
      "2026-05-15"
    );
    assert.equal(progress.period, "month");
    assert.equal(progress.start, "2026-05-01");
  });
});
