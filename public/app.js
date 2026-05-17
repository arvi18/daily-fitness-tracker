const TOKEN_KEY = "fitness_api_token";
const TOKEN_EXPIRY_KEY = "fitness_api_token_expires";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const DIET_TRUNCATE_LEN = 48;

const tokenInput = document.getElementById("apiToken");
const statusEl = document.getElementById("status");
const jsonInput = document.getElementById("jsonInput");
const goalsForm = document.getElementById("goalsForm");
const tableWrap = document.getElementById("tableWrap");
const weeklyCanvas = document.getElementById("weeklyChart");
const streakEl = document.getElementById("streakStats");
const paginationEl = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");

let chartInstance = null;
let allLogs = [];
let currentPage = 1;

/** Only these keys appear in the JSON editor (drops legacy water_ml etc.). */
function toLogJsonFields(body) {
  return {
    date: body.date,
    diet_summary: String(body.diet_summary ?? "").trim(),
    intake_kcal: Number(body.intake_kcal),
    protein_g: Number(body.protein_g),
    steps: Number(body.steps),
    burn_kcal: Number(body.burn_kcal),
    net_diff: Number(body.net_diff),
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseISODate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** e.g. 2026-05-16 → 16 May 2026 */
function formatDisplayDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  return parseISODate(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Shorter label for charts: 16 May */
function formatDisplayDateShort(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  return parseISODate(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatRange(start, end) {
  if (start === end) return formatDisplayDate(start);
  return `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`;
}

function formatDatesInText(text) {
  return text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, iso) => formatDisplayDate(iso));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDietCell(summary) {
  const text = escapeHtml(summary);
  const truncated = summary.length > DIET_TRUNCATE_LEN;
  const moreBtn = truncated
    ? `<button type="button" class="diet-more-btn" aria-expanded="false">More</button>`
    : "";
  return `<td class="diet-cell col-diet${truncated ? " diet-truncated" : ""}">
    <div class="diet-text">${text}</div>
    ${moreBtn}
  </td>`;
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

function saveToken(token) {
  const value = token.trim();
  if (!value) {
    clearSavedToken();
    return;
  }
  localStorage.setItem(TOKEN_KEY, value);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function loadSavedToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return "";

  const expires = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
  if (!expires) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
    return token;
  }

  if (Date.now() > expires) {
    clearSavedToken();
    return "";
  }

  return token;
}

function clearSavedToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  tokenInput.value = "";
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

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateLogPayload(body) {
  const requiredFields = [
    "date",
    "diet_summary",
    "intake_kcal",
    "protein_g",
    "steps",
    "burn_kcal",
    "net_diff",
  ];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `${field} is required`;
    }
  }

  if (!isValidDate(body.date)) return "date must be in YYYY-MM-DD format";
  if (typeof body.diet_summary !== "string") return "diet_summary must be a string";

  const numberFields = ["intake_kcal", "protein_g", "steps", "burn_kcal", "net_diff"];
  for (const field of numberFields) {
    if (!Number.isInteger(Number(body[field]))) {
      return `${field} must be an integer`;
    }
  }

  const intake = Number(body.intake_kcal);
  const burn = Number(body.burn_kcal);
  const expectedNet = intake - burn;
  if (Number(body.net_diff) !== expectedNet) {
    return `net_diff must equal intake_kcal - burn_kcal (${expectedNet})`;
  }

  return null;
}

function parseLogJson() {
  let body;
  try {
    body = JSON.parse(jsonInput.value);
  } catch {
    throw new Error("Invalid JSON — check commas and quotes");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("JSON must be an object");
  }

  return body;
}

function normalizeLogPayload(body) {
  const intake = Number(body.intake_kcal);
  const burn = Number(body.burn_kcal);
  return toLogJsonFields({
    ...body,
    net_diff: intake - burn,
  });
}

function fillJsonTemplate(payload) {
  jsonInput.value = JSON.stringify(toLogJsonFields(payload), null, 2);
}

function clearJsonInput() {
  jsonInput.value = "";
  clearStatus();
}

function fillTodayInJson() {
  const trimmed = jsonInput.value.trim();
  if (!trimmed) {
    jsonInput.value = JSON.stringify({ date: todayISO() }, null, 2);
    return;
  }
  const body = toLogJsonFields(parseLogJson());
  body.date = todayISO();
  fillJsonTemplate(body);
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
    .map((m) => `<div class="message ${m.type}">${formatDatesInText(m.text)}</div>`)
    .join("");
}

function renderStreaks(streaks) {
  streakEl.innerHTML = `
    <span>Logging streak: <strong>${streaks.logging}</strong> day(s)</span>
    <span>Full-goal streak: <strong>${streaks.all_goals}</strong> day(s)</span>
  `;
}

function renderWeeklyChart(summary) {
  const labels = summary.days.map((d) => formatDisplayDateShort(d.date));
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

function renderTable() {
  if (!allLogs.length) {
    tableWrap.innerHTML = '<p class="empty">No logs found.</p>';
    paginationEl.hidden = true;
    return;
  }

  const totalPages = Math.ceil(allLogs.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = allLogs.slice(start, start + PAGE_SIZE);

  const tbody = pageRows
    .map((row) => {
      const net = Number(row.net_diff);
      const netClass = net >= 0 ? "net-positive" : "net-negative";
      const netLabel = net > 0 ? `+${net}` : String(net);
      return `<tr>
        <td class="col-date">${formatDisplayDateShort(row.date)}</td>
        ${renderDietCell(row.diet_summary)}
        <td class="col-intake">${row.intake_kcal}</td>
        <td class="col-protein">${row.protein_g}g</td>
        <td class="col-steps">${Number(row.steps).toLocaleString()}</td>
        <td class="col-net ${netClass}">${netLabel}</td>
      </tr>`;
    })
    .join("");

  tableWrap.innerHTML = `<table class="history-table">
    <thead><tr>
      <th class="col-date">Date</th>
      <th class="col-diet">Diet</th>
      <th class="col-intake">Intake</th>
      <th class="col-protein">Protein</th>
      <th class="col-steps">Steps</th>
      <th class="col-net">Net</th>
    </tr></thead>
    <tbody>${tbody}</tbody>
  </table>`;

  paginationEl.hidden = totalPages <= 1;
  paginationInfo.textContent = `Page ${currentPage} of ${totalPages} · ${allLogs.length} total`;
  document.getElementById("prevPageBtn").disabled = currentPage <= 1;
  document.getElementById("nextPageBtn").disabled = currentPage >= totalPages;
}

function fillGoalsForm(goals) {
  goalsForm.steps_target.value = goals.steps_target;
  goalsForm.protein_g_target.value = goals.protein_g_target;
  goalsForm.intake_kcal_max.value = goals.intake_kcal_max;
  goalsForm.net_diff_target.value = goals.net_diff_target;
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
  allLogs = await api("/api/daily-log");
  currentPage = 1;
  renderTable();
}

async function refreshDashboard({ quiet = false } = {}) {
  if (!getToken()) {
    if (!quiet) setStatus("Enter your API token first", "error");
    return;
  }

  saveToken(getToken());

  try {
    const goals = await api("/api/goals");
    fillGoalsForm(goals);
    await loadPeriodProgress();
    await loadWeeklyChart();
    await loadLogs();
    if (!quiet) setStatus("Dashboard updated", "success");
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function saveLog() {
  clearStatus();

  let body;
  try {
    body = normalizeLogPayload(parseLogJson());
  } catch (err) {
    setStatus(err.message, "error");
    return;
  }

  const error = validateLogPayload(body);
  if (error) {
    setStatus(error, "error");
    return;
  }

  fillJsonTemplate(body);

  try {
    const result = await api("/api/daily-log", {
      method: "POST",
      body: JSON.stringify(body),
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

const saved = loadSavedToken();
if (saved) tokenInput.value = saved;

jsonInput.value = "";

tokenInput.addEventListener("input", () => saveToken(tokenInput.value));
tokenInput.addEventListener("change", () => saveToken(tokenInput.value));

tableWrap.addEventListener("click", (event) => {
  const btn = event.target.closest(".diet-more-btn");
  if (!btn) return;
  const row = btn.closest("tr");
  if (!row) return;
  const expanded = row.classList.toggle("diet-expanded");
  btn.textContent = expanded ? "Less" : "More";
  btn.setAttribute("aria-expanded", String(expanded));
});

document.getElementById("saveLogBtn").addEventListener("click", saveLog);
document.getElementById("clearJsonBtn").addEventListener("click", clearJsonInput);
document.getElementById("todayBtn").addEventListener("click", () => {
  try {
    fillTodayInJson();
  } catch (err) {
    setStatus(err.message, "error");
  }
});
document.getElementById("refreshBtn").addEventListener("click", () => refreshDashboard());
document.getElementById("clearTokenBtn").addEventListener("click", () => {
  clearSavedToken();
  setStatus("Saved token cleared", "info");
});
document.getElementById("prevPageBtn").addEventListener("click", () => {
  currentPage -= 1;
  renderTable();
});
document.getElementById("nextPageBtn").addEventListener("click", () => {
  currentPage += 1;
  renderTable();
});
goalsForm.addEventListener("submit", saveGoals);

if (getToken()) {
  refreshDashboard({ quiet: true });
}

