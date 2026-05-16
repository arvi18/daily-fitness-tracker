import { createClient } from "@libsql/client/http";

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
}