export const DEFAULT_GOALS = {
  steps_target: 10000,
  protein_g_target: 100,
  intake_kcal_max: 2200,
  net_diff_target: -300,
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
      score: { met: 0, total: 4, percent: 0 },
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

export function monthRange(endDate) {
  const [year, month] = endDate.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  return { start, end: endDate };
}

export function previousWeekRange(endDate) {
  const { start } = weekRange(endDate);
  const end = shiftDate(start, -1);
  const prevStart = shiftDate(end, -6);
  return { start: prevStart, end };
}

export function previousMonthRange(endDate) {
  const [year, month] = endDate.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(prevYear, prevMonth, 0).getDate();
  const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function percentChange(current, previous) {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function buildPeriodComparison(current, previous, periodLabel) {
  if (previous.totals.days_logged === 0) return null;

  const previousLabel = periodLabel === "week" ? "last week" : "last month";

  const metrics = current.metrics.map((metric) => {
    const prevMetric = previous.metrics.find((m) => m.key === metric.key);
    const previousAvg = prevMetric?.current ?? 0;
    const change_pct = percentChange(metric.current, previousAvg);

    if (change_pct === null) return null;

    return {
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      current: metric.current,
      previous: previousAvg,
      change_pct,
    };
  }).filter(Boolean);

  const totals = {
    days_logged: {
      current: current.totals.days_logged,
      previous: previous.totals.days_logged,
      change_pct: percentChange(current.totals.days_logged, previous.totals.days_logged),
    },
    goals_hit_days: {
      current: current.totals.goals_hit_days,
      previous: previous.totals.goals_hit_days,
      change_pct: percentChange(current.totals.goals_hit_days, previous.totals.goals_hit_days),
    },
  };

  const hasTotalsComparison =
    totals.days_logged.change_pct !== null || totals.goals_hit_days.change_pct !== null;

  if (metrics.length === 0 && !hasTotalsComparison) return null;

  return {
    previous_label: previousLabel,
    previous_range: { start: previous.start, end: previous.end },
    metrics,
    totals,
  };
}

function eachDateInRange(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function buildPeriodProgress(logs, goals, start, end, periodLabel) {
  const byDate = new Map(logs.map((row) => [row.date, rowToLog(row)]));
  const dates = eachDateInRange(start, end);
  const dayResults = dates.map((date) => {
    const log = byDate.get(date) ?? null;
    const { score, metrics } = evaluateProgress(log, goals);
    return { date, log, score, metrics };
  });

  const loggedDays = dayResults.filter((d) => d.log);
  const daysLogged = loggedDays.length;
  const totalDays = dates.length;
  const goalsHitDays = loggedDays.filter((d) => d.score.met === d.score.total).length;

  const avg = (key) => {
    if (daysLogged === 0) return 0;
    return Math.round(loggedDays.reduce((sum, d) => sum + d.log[key], 0) / daysLogged);
  };

  const daysMet = (predicate) => loggedDays.filter((d) => predicate(d.log)).length;

  const metricDefs = [
    {
      key: "steps",
      label: "Steps",
      unit: "",
      current: avg("steps"),
      target: goals.steps_target,
      days_met: daysMet((log) => log.steps >= goals.steps_target),
      met: daysLogged > 0 && daysMet((log) => log.steps >= goals.steps_target) >= Math.ceil(daysLogged / 2),
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      current: avg("protein_g"),
      target: goals.protein_g_target,
      days_met: daysMet((log) => log.protein_g >= goals.protein_g_target),
      met: daysLogged > 0 && daysMet((log) => log.protein_g >= goals.protein_g_target) >= Math.ceil(daysLogged / 2),
    },
    {
      key: "intake",
      label: "Calorie intake",
      unit: "kcal",
      current: avg("intake_kcal"),
      target: goals.intake_kcal_max,
      days_met: daysMet((log) => log.intake_kcal <= goals.intake_kcal_max),
      met: daysLogged > 0 && daysMet((log) => log.intake_kcal <= goals.intake_kcal_max) >= Math.ceil(daysLogged / 2),
    },
    {
      key: "net_diff",
      label: "Net calories",
      unit: "kcal",
      current: avg("net_diff"),
      target: goals.net_diff_target,
      days_met: daysMet((log) => log.net_diff <= goals.net_diff_target),
      met: daysLogged > 0 && daysMet((log) => log.net_diff <= goals.net_diff_target) >= Math.ceil(daysLogged / 2),
    },
  ];

  const metrics = metricDefs.map((m) => ({
    key: m.key,
    label: m.label,
    current: m.current,
    target: m.target,
    unit: m.unit,
    days_met: m.days_met,
    days_logged: daysLogged,
    met: m.met,
    percent: daysLogged === 0 ? 0 : Math.round((m.days_met / daysLogged) * 100),
  }));

  const met = metrics.filter((m) => m.met).length;
  const score = {
    met,
    total: metrics.length,
    percent: metrics.length === 0 ? 0 : Math.round((met / metrics.length) * 100),
  };

  return {
    period: periodLabel,
    start,
    end,
    totals: {
      days_in_period: totalDays,
      days_logged: daysLogged,
      goals_hit_days: goalsHitDays,
    },
    metrics,
    score,
    messages: buildPeriodMessages({
      periodLabel,
      start,
      end,
      daysLogged,
      totalDays,
      goalsHitDays,
      metrics,
      score,
    }),
  };
}

export function buildPeriodMessages({
  periodLabel,
  start,
  end,
  daysLogged,
  totalDays,
  goalsHitDays,
  metrics,
  score,
}) {
  const messages = [];
  const label = periodLabel === "week" ? "this week" : "this month";

  if (daysLogged === 0) {
    messages.push({
      type: "info",
      text: `No logs ${label} yet (${start} to ${end}). Log your day when you are ready.`,
    });
    return messages;
  }

  messages.push({
    type: "info",
    text: `Logged ${daysLogged} of ${totalDays} days ${label}.`,
  });

  if (goalsHitDays > 0) {
    messages.push({
      type: "success",
      text: `${goalsHitDays} day${goalsHitDays === 1 ? "" : "s"} with all goals hit ${label}.`,
    });
  }

  if (score.met === score.total) {
    messages.push({
      type: "success",
      text: `Strong ${label} — most goals on track across your logged days.`,
    });
  }

  for (const metric of metrics) {
    if (metric.days_met === 0) continue;
    messages.push({
      type: metric.met ? "success" : "info",
      text: `${metric.label}: hit goal on ${metric.days_met}/${metric.days_logged} logged days (avg ${metric.current}${metric.unit ? ` ${metric.unit}` : ""}).`,
    });
  }

  return messages;
}

function withPeriodComparison(logs, goals, endDate, periodLabel, currentRange, previousRange) {
  const current = buildPeriodProgress(
    logs,
    goals,
    currentRange.start,
    currentRange.end,
    periodLabel
  );
  const previous = buildPeriodProgress(
    logs,
    goals,
    previousRange.start,
    previousRange.end,
    periodLabel
  );
  const comparison = buildPeriodComparison(current, previous, periodLabel);
  return comparison ? { ...current, comparison } : current;
}

export function buildWeeklyProgress(logs, goals, endDate) {
  return withPeriodComparison(logs, goals, endDate, "week", weekRange(endDate), previousWeekRange(endDate));
}

export function buildMonthlyProgress(logs, goals, endDate) {
  return withPeriodComparison(
    logs,
    goals,
    endDate,
    "month",
    monthRange(endDate),
    previousMonthRange(endDate)
  );
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
          },
  };
}
