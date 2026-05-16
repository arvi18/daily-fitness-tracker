import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { db, initDb } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateDailyLog(body) {
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

  return null;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(date) DO UPDATE SET
          diet_summary = excluded.diet_summary,
          intake_kcal = excluded.intake_kcal,
          protein_g = excluded.protein_g,
          steps = excluded.steps,
          burn_kcal = excluded.burn_kcal,
          net_diff = excluded.net_diff,
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
    const result = await db.execute(`
      SELECT
        date,
        diet_summary,
        intake_kcal,
        protein_g,
        steps,
        burn_kcal,
        net_diff,
        created_at,
        updated_at
      FROM daily_logs
      ORDER BY date DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/daily-log error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch logs",
    });
  }
});

await initDb();

app.listen(PORT, () => {
  console.log(`Daily Fitness Tracker running on port ${PORT}`);
});