import "dotenv/config";
import { createApp } from "./app.js";
import { db, initDb } from "./db.js";

const requiredEnv = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "API_TOKEN"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3000;

await initDb();

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Daily Fitness Tracker running on port ${PORT}`);
});
