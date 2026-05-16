export const DEFAULT_GOALS = {
  steps_target: 10000,
  protein_g_target: 100,
  intake_kcal_max: 2200,
  net_diff_target: -300,
  water_ml_target: 2500,
};

function toNumber(value) {
  return Number(value);
}

export function rowToGoals(row) {
  if (!row) return { ...DEFAULT_GOALS };
  return {
    steps_target: toNumber(row.steps_target),
    protein_g_target: toNumber(row.protein_g_target),
    intake_kcal_max: toNumber(row.intake_kcal_max),
    net_diff_target: toNumber(row.net_diff_target),
    water_ml_target: toNumber(row.water_ml_target),
  };
}

export function rowToLog(row) {
  if (!row) return null;
  return {
    date: row.date,
    diet_summary: row.diet_summary,
    intake_kcal: toNumber(row.intake_kcal),
    protein_g: toNumber(row.protein_g),
    steps: toNumber(row.steps),
    burn_kcal: toNumber(row.burn_kcal),
    net_diff: toNumber(row.net_diff),
    water_ml: row.water_ml == null ? 0 : toNumber(row.water_ml),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function pct(current, target) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function evaluateProgress(log, goals) {
  if (!log) {
    return {
      metrics: [],
      score: { met: 0, total: 5, percent: 0 },
      messages: [
        {
          type: "info",
          text: "No log for this day yet — save one to start tracking progress.",
        },
      ],
    };
  }

  const metrics = [
    {
      key: "steps",
      label: "Steps",
      current: log.steps,
      target: goals.steps_target,
      met: log.steps >= goals.steps_target,
      percent: pct(log.steps, goals.steps_target),
      unit: "",
    },
    {
      key: "protein",
      label: "Protein",
      current: log.protein_g,
      target: goals.protein_g_target,
      met: log.protein_g >= goals.protein_g_target,
      percent: pct(log.protein_g, goals.protein_g_target),
      unit: "g",
    },
    {
      key: "intake",
      label: "Calorie intake",
      current: log.intake_kcal,
      target: goals.intake_kcal_max,
      met: log.intake_kcal <= goals.intake_kcal_max,
      percent: Math.min(100, Math.round((log.intake_kcal / goals.intake_kcal_max) * 100)),
      unit: "kcal",
      underTarget: true,
    },
    {
      key: "net_diff",
      label: "Net calories",
      current: log.net_diff,
      target: goals.net_diff_target,
      met: log.net_diff <= goals.net_diff_target,
      percent: goals.net_diff_target === 0
        ? log.net_diff <= 0
          ? 100
          : 0
        : log.net_diff <= goals.net_diff_target
          ? 100
          : Math.max(0, 100 - Math.round(((log.net_diff - goals.net_diff_target) / Math.abs(goals.net_diff_target || 1)) * 100)),
      unit: "kcal",
      underTarget: true,
    },
    {
      key: "water",
      label: "Water",
      current: log.water_ml ?? 0,
      target: goals.water_ml_target,
      met: (log.water_ml ?? 0) >= goals.water_ml_target,
      percent: pct(log.water_ml ?? 0, goals.water_ml_target),
      unit: "ml",
    },
  ];

  const met = metrics.filter((m) => m.met).length;
  const score = {
    met,
    total: metrics.length,
    percent: Math.round((met / metrics.length) * 100),
  };

  return {
    metrics,
    score,
    messages: buildMessages(metrics, log, score),
  };
}

export function buildMessages(metrics, log, score) {
  const messages = [];

  if (score.met === score.total) {
    messages.push({
      type: "success",
      text: "Perfect day — you hit every goal!",
    });
  } else if (score.met >= Math.ceil(score.total / 2)) {
    messages.push({
      type: "success",
      text: `Nice work — ${score.met} of ${score.total} goals met today.`,
    });
  } else if (score.met > 0) {
    messages.push({
      type: "info",
      text: `You are on your way — ${score.met} of ${score.total} goals met.`,
    });
  } else {
    messages.push({
      type: "info",
      text: "Tough day so far — tomorrow is a fresh start.",
    });
  }

  for (const metric of metrics) {
    if (!metric.met) continue;
    if (metric.key === "steps") {
      messages.push({
        type: "success",
        text: `Step goal crushed (${log.steps.toLocaleString()} steps).`,
      });
    }
    if (metric.key === "protein") {
      messages.push({
        type: "success",
        text: `Protein target reached (${log.protein_g}g).`,
      });
    }
    if (metric.key === "intake") {
      messages.push({
        type: "success",
        text: `Stayed under your calorie cap (${log.intake_kcal} kcal).`,
      });
    }
    if (metric.key === "net_diff") {
      messages.push({
        type: "success",
        text: `Net calorie goal achieved (${log.net_diff} kcal).`,
      });
    }
    if (metric.key === "water") {
      messages.push({
        type: "success",
        text: `Hydration goal met (${log.water_ml ?? 0} ml).`,
      });
    }
  }

  return messages;
}

export function computeStreaks(logs, goals, endDate) {
  const byDate = new Map(logs.map((row) => [row.date, rowToLog(row)]));

  let loggingStreak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const date = shiftDate(endDate, -offset);
    if (!byDate.has(date)) break;
    loggingStreak++;
  }

  let goalsStreak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const date = shiftDate(endDate, -offset);
    const log = byDate.get(date);
    if (!log) break;
    const { score } = evaluateProgress(log, goals);
    if (score.met < score.total) break;
    goalsStreak++;
  }

  return { logging: loggingStreak, all_goals: goalsStreak };
}

export function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekRange(endDate) {
  const start = shiftDate(endDate, -6);
  return { start, end: endDate };
}

export function buildWeeklySummary(logs, goals, endDate) {
  const { start, end } = weekRange(endDate);
  const byDate = new Map(logs.map((row) => [row.date, rowToLog(row)]));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = shiftDate(start, i);
    const log = byDate.get(date) ?? null;
    const { score } = evaluateProgress(log, goals);
    days.push({
      date,
      logged: Boolean(log),
      intake_kcal: log?.intake_kcal ?? null,
      steps: log?.steps ?? null,
      net_diff: log?.net_diff ?? null,
      water_ml: log?.water_ml ?? null,
      goals_met: score.met,
      goals_total: score.total,
    });
  }

  const loggedDays = days.filter((d) => d.logged);
  const sum = (key) => loggedDays.reduce((acc, d) => acc + (d[key] ?? 0), 0);

  return {
    start,
    end,
    days,
    totals: {
      days_logged: loggedDays.length,
      goals_hit_days: loggedDays.filter((d) => d.goals_met === d.goals_total && d.goals_total > 0).length,
    },
    averages:
      loggedDays.length === 0
        ? null
        : {
            intake_kcal: Math.round(sum("intake_kcal") / loggedDays.length),
            steps: Math.round(sum("steps") / loggedDays.length),
            net_diff: Math.round(sum("net_diff") / loggedDays.length),
            water_ml: Math.round(sum("water_ml") / loggedDays.length),
          },
  };
}
