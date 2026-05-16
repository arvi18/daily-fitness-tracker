import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildWeeklySummary,
  computeStreaks,
  evaluateProgress,
  rowToGoals,
  rowToLog,
} from "./lib/progress.js";
import { isValidDate, validateDailyLog, validateGoals } from "./lib/validation.js";

async function fetchGoals(db) {
  const result = await db.execute("SELECT * FROM goals WHERE id = 1");
  return result.rows[0] ?? null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logSelect = `
  SELECT
    date,
    diet_summary,
    intake_kcal,
    protein_g,
    steps,
    burn_kcal,
    net_diff,
    water_ml,
    created_at,
    updated_at
  FROM daily_logs
`;

export function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  function requireApiToken(req, res, next) {
    const token = req.headers["x-api-token"];

    if (!process.env.API_TOKEN) {
      return res.status(500).json({
        status: "error",
        message: "API_TOKEN is not configured on server",
      });
    }

    if (token !== process.env.API_TOKEN) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    next();
  }

  app.get("/api/health", async (req, res) => {
    try {
      await db.execute("SELECT 1");
      res.json({ status: "ok", database: "ok" });
    } catch (err) {
      console.error("GET /api/health error:", err);
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });

  app.get("/api/goals", requireApiToken, async (req, res) => {
    try {
      const row = await fetchGoals(db);
      res.json(rowToGoals(row));
    } catch (err) {
      console.error("GET /api/goals error:", err);
      res.status(500).json({ status: "error", message: "Failed to fetch goals" });
    }
  });

  app.put("/api/goals", requireApiToken, async (req, res) => {
    try {
      const error = validateGoals(req.body);
      if (error) {
        return res.status(400).json({ status: "error", message: error });
      }

      const {
        steps_target,
        protein_g_target,
        intake_kcal_max,
        net_diff_target,
        water_ml_target,
      } = req.body;

      await db.execute({
        sql: `
          INSERT INTO goals (id, steps_target, protein_g_target, intake_kcal_max, net_diff_target, water_ml_target, updated_at)
          VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            steps_target = excluded.steps_target,
            protein_g_target = excluded.protein_g_target,
            intake_kcal_max = excluded.intake_kcal_max,
            net_diff_target = excluded.net_diff_target,
            water_ml_target = excluded.water_ml_target,
            updated_at = CURRENT_TIMESTAMP
        `,
        args: [
          Number(steps_target),
          Number(protein_g_target),
          Number(intake_kcal_max),
          Number(net_diff_target),
          Number(water_ml_target),
        ],
      });

      res.json({ status: "success", message: "Goals updated" });
    } catch (err) {
      console.error("PUT /api/goals error:", err);
      res.status(500).json({ status: "error", message: "Failed to update goals" });
    }
  });

  app.get("/api/progress", requireApiToken, async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    if (!isValidDate(date)) {
      return res.status(400).json({
        status: "error",
        message: "date must be in YYYY-MM-DD format",
      });
    }

    try {
      const goalsRow = await fetchGoals(db);
      const goals = rowToGoals(goalsRow);

      const logResult = await db.execute({
        sql: `${logSelect} WHERE date = ?`,
        args: [date],
      });
      const log = rowToLog(logResult.rows[0]);

      const allLogs = await db.execute(`${logSelect} ORDER BY date DESC`);
      const streaks = computeStreaks(allLogs.rows, goals, date);
      const progress = evaluateProgress(log, goals);

      res.json({
        date,
        log,
        goals,
        ...progress,
        streaks,
      });
    } catch (err) {
      console.error("GET /api/progress error:", err);
      res.status(500).json({ status: "error", message: "Failed to fetch progress" });
    }
  });

  app.get("/api/summary/weekly", requireApiToken, async (req, res) => {
    const endDate = req.query.end || new Date().toISOString().slice(0, 10);

    if (!isValidDate(endDate)) {
      return res.status(400).json({
        status: "error",
        message: "end must be in YYYY-MM-DD format",
      });
    }

    try {
      const goalsRow = await fetchGoals(db);
      const goals = rowToGoals(goalsRow);
      const result = await db.execute(`${logSelect} ORDER BY date DESC`);
      res.json(buildWeeklySummary(result.rows, goals, endDate));
    } catch (err) {
      console.error("GET /api/summary/weekly error:", err);
      res.status(500).json({ status: "error", message: "Failed to fetch weekly summary" });
    }
  });

  app.post("/api/daily-log", requireApiToken, async (req, res) => {
    try {
      const error = validateDailyLog(req.body);
      if (error) {
        return res.status(400).json({ status: "error", message: error });
      }

      const {
        date,
        diet_summary,
        intake_kcal,
        protein_g,
        steps,
        burn_kcal,
        net_diff,
        water_ml,
      } = req.body;

      await db.execute({
        sql: `
          INSERT INTO daily_logs (
            date,
            diet_summary,
            intake_kcal,
            protein_g,
            steps,
            burn_kcal,
            net_diff,
            water_ml,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(date) DO UPDATE SET
            diet_summary = excluded.diet_summary,
            intake_kcal = excluded.intake_kcal,
            protein_g = excluded.protein_g,
            steps = excluded.steps,
            burn_kcal = excluded.burn_kcal,
            net_diff = excluded.net_diff,
            water_ml = excluded.water_ml,
            updated_at = CURRENT_TIMESTAMP
        `,
        args: [
          date,
          diet_summary,
          Number(intake_kcal),
          Number(protein_g),
          Number(steps),
          Number(burn_kcal),
          Number(net_diff),
          water_ml === undefined || water_ml === null || water_ml === ""
            ? 0
            : Number(water_ml),
        ],
      });

      res.json({
        status: "success",
        message: `Log saved for ${date}`,
      });
    } catch (err) {
      console.error("POST /api/daily-log error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to save log",
      });
    }
  });

  app.get("/api/daily-log", requireApiToken, async (req, res) => {
    try {
      const result = await db.execute(`${logSelect} ORDER BY date DESC`);
      res.json(result.rows.map(rowToLog));
    } catch (err) {
      console.error("GET /api/daily-log error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch logs",
      });
    }
  });

  app.get("/api/daily-log/:date", requireApiToken, async (req, res) => {
    const { date } = req.params;

    if (!isValidDate(date)) {
      return res.status(400).json({
        status: "error",
        message: "date must be in YYYY-MM-DD format",
      });
    }

    try {
      const result = await db.execute({
        sql: `${logSelect} WHERE date = ?`,
        args: [date],
      });

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          message: `No log found for ${date}`,
        });
      }

      res.json(rowToLog(result.rows[0]));
    } catch (err) {
      console.error("GET /api/daily-log/:date error:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to fetch log",
      });
    }
  });

  return app;
}
