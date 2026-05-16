import { createClient } from "@libsql/client/http";
import { DEFAULT_GOALS } from "./lib/progress.js";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function ensureColumn(table, column, type) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      date TEXT PRIMARY KEY,
      diet_summary TEXT NOT NULL,
      intake_kcal INTEGER NOT NULL,
      protein_g INTEGER NOT NULL,
      steps INTEGER NOT NULL,
      burn_kcal INTEGER NOT NULL,
      net_diff INTEGER NOT NULL,
      water_ml INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("daily_logs", "water_ml", "INTEGER NOT NULL DEFAULT 0");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      steps_target INTEGER NOT NULL,
      protein_g_target INTEGER NOT NULL,
      intake_kcal_max INTEGER NOT NULL,
      net_diff_target INTEGER NOT NULL,
      water_ml_target INTEGER NOT NULL DEFAULT 2500,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("goals", "water_ml_target", "INTEGER NOT NULL DEFAULT 2500");

  const existing = await db.execute("SELECT id FROM goals WHERE id = 1");
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `
        INSERT INTO goals (
          id, steps_target, protein_g_target, intake_kcal_max, net_diff_target, water_ml_target
        ) VALUES (1, ?, ?, ?, ?, ?)
      `,
      args: [
        DEFAULT_GOALS.steps_target,
        DEFAULT_GOALS.protein_g_target,
        DEFAULT_GOALS.intake_kcal_max,
        DEFAULT_GOALS.net_diff_target,
        DEFAULT_GOALS.water_ml_target,
      ],
    });
  }
}
