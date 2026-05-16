const tokenInput = document.getElementById("apiToken");
const statusEl = document.getElementById("status");
const goalsForm = document.getElementById("goalsForm");
const logForm = document.getElementById("logForm");
const tableWrap = document.getElementById("tableWrap");
const weeklyCanvas = document.getElementById("weeklyChart");
const streakEl = document.getElementById("streakStats");

let chartInstance = null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatRange(start, end) {
  return `${start} → ${end}`;
}

function formatChange(changePct) {
  if (changePct === null || changePct === undefined) return "";
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct}%`;
}

function comparisonChip(changePct, label) {
  if (changePct === null || changePct === undefined) return "";
  const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
  return `<span class="change ${direction}" title="vs ${label}">${formatChange(changePct)} vs ${label}</span>`;
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status visible ${type}`;
}

function clearStatus() {
  statusEl.className = "status";
  statusEl.textContent = "";
}

function getToken() {
  return tokenInput.value.trim();
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    "x-api-token": getToken(),
    ...options.headers,
  };

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
}

function calcNetDiff() {
  const intake = Number(logForm.intake_kcal.value) || 0;
  const burn = Number(logForm.burn_kcal.value) || 0;
  logForm.net_diff.value = intake - burn;
}

function renderPeriodProgress(data, { panelId, messagesId, badgeId, rangeId, comparisonId }) {
  const { score, metrics, messages, totals, start, end, comparison } = data;
  const comparisonByKey = new Map((comparison?.metrics ?? []).map((m) => [m.key, m]));

  document.getElementById(badgeId).textContent =
    totals.days_logged === 0
      ? "No logs yet"
      : `${score.met}/${score.total} goals on track`;
  document.getElementById(badgeId).className = `score-badge ${
    score.met === score.total && totals.days_logged > 0 ? "complete" : ""
  }`;
  document.getElementById(rangeId).textContent = formatRange(start, end);

  const comparisonEl = document.getElementById(comparisonId);
  if (comparison) {
    const { previous_label, previous_range, totals: cmpTotals } = comparison;
    const parts = [];
    if (cmpTotals.days_logged.change_pct !== null) {
      parts.push(`Days logged ${comparisonChip(cmpTotals.days_logged.change_pct, previous_label)}`);
    }
    if (cmpTotals.goals_hit_days.change_pct !== null) {
      parts.push(`Full-goal days ${comparisonChip(cmpTotals.goals_hit_days.change_pct, previous_label)}`);
    }
    comparisonEl.className = "comparison-banner visible";
    comparisonEl.innerHTML = `
      <span class="comparison-title">vs ${previous_label} (${formatRange(previous_range.start, previous_range.end)})</span>
      ${parts.length ? `<span class="comparison-totals">${parts.join(" · ")}</span>` : ""}
    `;
  } else {
    comparisonEl.className = "comparison-banner";
    comparisonEl.innerHTML = "";
  }

  document.getElementById(panelId).innerHTML = metrics
    .map((m) => {
      const cmp = comparisonByKey.get(m.key);
      const changeHtml = cmp ? comparisonChip(cmp.change_pct, comparison.previous_label) : "";
      return `
    <div class="metric">
      <div class="metric-head">
        <span>${m.label}</span>
        <span class="${m.met ? "met-text" : ""}">
          ${m.days_met}/${m.days_logged} days · avg ${m.current}${m.unit ? ` ${m.unit}` : ""}
          ${changeHtml}
        </span>
      </div>
      <div class="bar"><div class="bar-fill ${m.met ? "met" : ""}" style="width:${m.percent}%"></div></div>
    </div>`;
    })
    .join("");

  document.getElementById(messagesId).innerHTML = messages
    .map((m) => `<div class="message ${m.type}">${m.text}</div>`)
    .join("");
}

function renderStreaks(streaks) {
  streakEl.innerHTML = `
    <span>Logging streak: <strong>${streaks.logging}</strong> day(s)</span>
    <span>Full-goal streak: <strong>${streaks.all_goals}</strong> day(s)</span>
  `;
}

function renderWeeklyChart(summary) {
  const labels = summary.days.map((d) => d.date.slice(5));
  const steps = summary.days.map((d) => d.steps ?? 0);
  const intake = summary.days.map((d) => d.intake_kcal ?? 0);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(weeklyCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Steps",
          data: steps,
          backgroundColor: "rgba(61, 214, 140, 0.7)",
          yAxisID: "y",
        },
        {
          label: "Intake (kcal)",
          data: intake,
          backgroundColor: "rgba(230, 180, 80, 0.7)",
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e8edf4" } } },
      scales: {
        x: { ticks: { color: "#8b9cb3" }, grid: { color: "#2e3d52" } },
        y: {
          position: "left",
          ticks: { color: "#8b9cb3" },
          grid: { color: "#2e3d52" },
        },
        y1: {
          position: "right",
          ticks: { color: "#8b9cb3" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  const avg = summary.averages;
  document.getElementById("weeklyStats").textContent = avg
    ? `7-day avg: ${avg.steps.toLocaleString()} steps · ${avg.intake_kcal} kcal intake · ${avg.net_diff} net kcal`
    : "Log at least one day this week to see averages.";
}

function renderTable(rows) {
  if (!rows.length) {
    tableWrap.innerHTML = '<p class="empty">No logs found.</p>';
    return;
  }

  const tbody = rows
    .map((row) => {
      const net = Number(row.net_diff);
      const netClass = net >= 0 ? "net-positive" : "net-negative";
      return `<tr>
        <td>${row.date}</td>
        <td>${row.diet_summary}</td>
        <td>${row.intake_kcal}</td>
        <td>${row.protein_g}g</td>
        <td>${Number(row.steps).toLocaleString()}</td>
        <td>${row.water_ml ?? 0} ml</td>
        <td class="${netClass}">${net > 0 ? "+" : ""}${net}</td>
      </tr>`;
    })
    .join("");

  tableWrap.innerHTML = `<table>
    <thead><tr>
      <th>date</th><th>diet</th><th>intake</th><th>protein</th><th>steps</th><th>water</th><th>net</th>
    </tr></thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

function fillLogForm(log) {
  logForm.date.value = log?.date || todayISO();
  logForm.diet_summary.value = log?.diet_summary || "";
  logForm.intake_kcal.value = log?.intake_kcal ?? "";
  logForm.protein_g.value = log?.protein_g ?? "";
  logForm.steps.value = log?.steps ?? "";
  logForm.burn_kcal.value = log?.burn_kcal ?? "";
  logForm.water_ml.value = log?.water_ml ?? 0;
  calcNetDiff();
}

function fillGoalsForm(goals) {
  goalsForm.steps_target.value = goals.steps_target;
  goalsForm.protein_g_target.value = goals.protein_g_target;
  goalsForm.intake_kcal_max.value = goals.intake_kcal_max;
  goalsForm.net_diff_target.value = goals.net_diff_target;
  goalsForm.water_ml_target.value = goals.water_ml_target;
}

async function loadLogForForm() {
  const date = logForm.date.value || todayISO();
  try {
    const log = await api(`/api/daily-log/${date}`);
    fillLogForm(log);
  } catch {
    fillLogForm({ date });
  }
}

async function loadPeriodProgress() {
  const end = todayISO();
  const [weekly, monthly] = await Promise.all([
    api(`/api/progress/weekly?end=${end}`),
    api(`/api/progress/monthly?end=${end}`),
  ]);

  renderStreaks(weekly.streaks);
  renderPeriodProgress(weekly, {
    panelId: "weekProgressPanel",
    messagesId: "weekProgressMessages",
    badgeId: "weekScoreBadge",
    rangeId: "weekRangeLabel",
    comparisonId: "weekComparison",
  });
  renderPeriodProgress(monthly, {
    panelId: "monthProgressPanel",
    messagesId: "monthProgressMessages",
    badgeId: "monthScoreBadge",
    rangeId: "monthRangeLabel",
    comparisonId: "monthComparison",
  });
}

async function loadWeeklyChart() {
  const summary = await api(`/api/summary/weekly?end=${todayISO()}`);
  renderWeeklyChart(summary);
}

async function loadLogs() {
  const rows = await api("/api/daily-log");
  renderTable(rows);
}

async function refreshDashboard({ quiet = false } = {}) {
  if (!getToken()) {
    if (!quiet) setStatus("Enter your API token first", "error");
    return;
  }

  try {
    const goals = await api("/api/goals");
    fillGoalsForm(goals);
    await loadPeriodProgress();
    await loadWeeklyChart();
    await loadLogs();
    await loadLogForForm();
    if (!quiet) setStatus("Dashboard updated", "success");
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function saveLog(event) {
  event.preventDefault();
  clearStatus();
  calcNetDiff();

  const payload = {
    date: logForm.date.value,
    diet_summary: logForm.diet_summary.value.trim(),
    intake_kcal: Number(logForm.intake_kcal.value),
    protein_g: Number(logForm.protein_g.value),
    steps: Number(logForm.steps.value),
    burn_kcal: Number(logForm.burn_kcal.value),
    net_diff: Number(logForm.net_diff.value),
    water_ml: Number(logForm.water_ml.value) || 0,
  };

  try {
    const result = await api("/api/daily-log", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(result.message, "success");
    await refreshDashboard({ quiet: true });
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function saveGoals(event) {
  event.preventDefault();
  clearStatus();

  const payload = {
    steps_target: Number(goalsForm.steps_target.value),
    protein_g_target: Number(goalsForm.protein_g_target.value),
    intake_kcal_max: Number(goalsForm.intake_kcal_max.value),
    net_diff_target: Number(goalsForm.net_diff_target.value),
    water_ml_target: Number(goalsForm.water_ml_target.value),
  };

  try {
    const result = await api("/api/goals", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setStatus(result.message, "success");
    await refreshDashboard({ quiet: true });
  } catch (err) {
    setStatus(err.message, "error");
  }
}

const savedToken = localStorage.getItem("fitness_api_token");
if (savedToken) tokenInput.value = savedToken;

tokenInput.addEventListener("input", () => {
  localStorage.setItem("fitness_api_token", tokenInput.value);
});

logForm.date.value = todayISO();

["intake_kcal", "burn_kcal"].forEach((name) => {
  logForm[name].addEventListener("input", calcNetDiff);
});

logForm.date.addEventListener("change", () => loadLogForForm());

document.getElementById("refreshBtn").addEventListener("click", () => refreshDashboard());
document.getElementById("todayBtn").addEventListener("click", () => {
  logForm.date.value = todayISO();
  loadLogForForm();
  refreshDashboard();
});
logForm.addEventListener("submit", saveLog);
goalsForm.addEventListener("submit", saveGoals);

if (getToken()) {
  refreshDashboard({ quiet: true });
}
