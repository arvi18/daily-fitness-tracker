import { createClient } from "@libsql/client/http";
import { DEFAULT_GOALS } from "./lib/progress.js";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      steps_target INTEGER NOT NULL,
      protein_g_target INTEGER NOT NULL,
      intake_kcal_max INTEGER NOT NULL,
      net_diff_target INTEGER NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existing = await db.execute("SELECT id FROM goals WHERE id = 1");
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `
        INSERT INTO goals (
          id, steps_target, protein_g_target, intake_kcal_max, net_diff_target
        ) VALUES (1, ?, ?, ?, ?)
      `,
      args: [
        DEFAULT_GOALS.steps_target,
        DEFAULT_GOALS.protein_g_target,
        DEFAULT_GOALS.intake_kcal_max,
        DEFAULT_GOALS.net_diff_target,
      ],
    });
  }
}
