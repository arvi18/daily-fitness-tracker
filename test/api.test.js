import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../app.js";

process.env.API_TOKEN = "test-token";

const goalsRow = {
  id: 1,
  steps_target: 10000,
  protein_g_target: 100,
  intake_kcal_max: 2200,
  net_diff_target: -300,
  water_ml_target: 2500,
};

const logs = new Map();

function createMockDb() {
  return {
    async execute(query) {
      const sql = typeof query === "string" ? query : query.sql;
      const args = typeof query === "string" ? [] : query.args ?? [];

      if (sql === "SELECT 1") return { rows: [{ ok: 1 }] };

      if (sql.includes("FROM goals WHERE id = 1")) {
        return { rows: [goalsRow] };
      }

      if (sql.includes("INSERT INTO goals")) {
        Object.assign(goalsRow, {
          steps_target: args[0],
          protein_g_target: args[1],
          intake_kcal_max: args[2],
          net_diff_target: args[3],
          water_ml_target: args[4],
        });
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO daily_logs")) {
        const [
          date,
          diet_summary,
          intake_kcal,
          protein_g,
          steps,
          burn_kcal,
          net_diff,
          water_ml,
        ] = args;
        logs.set(date, {
          date,
          diet_summary,
          intake_kcal,
          protein_g,
          steps,
          burn_kcal,
          net_diff,
          water_ml,
          created_at: "now",
          updated_at: "now",
        });
        return { rows: [] };
      }

      if (sql.includes("WHERE date = ?")) {
        const date = args[0];
        const row = logs.get(date);
        return { rows: row ? [row] : [] };
      }

      if (sql.includes("FROM daily_logs")) {
        return {
          rows: [...logs.values()].sort((a, b) => b.date.localeCompare(a.date)),
        };
      }

      throw new Error(`Unhandled SQL in mock: ${sql}`);
    },
  };
}

describe("API", () => {
  const app = createApp(createMockDb());
  const auth = { "x-api-token": "test-token" };

  before(() => {
    logs.clear();
  });

  after(() => {
    logs.clear();
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.database, "ok");
  });

  it("POST /api/daily-log rejects bad net_diff", async () => {
    const res = await request(app)
      .post("/api/daily-log")
      .set(auth)
      .send({
        date: "2026-05-15",
        diet_summary: "test",
        intake_kcal: 2000,
        protein_g: 100,
        steps: 5000,
        burn_kcal: 2500,
        net_diff: 0,
      });

    assert.equal(res.status, 400);
  });

  it("POST /api/daily-log saves valid payload", async () => {
    const res = await request(app)
      .post("/api/daily-log")
      .set(auth)
      .send({
        date: "2026-05-15",
        diet_summary: "test",
        intake_kcal: 2000,
        protein_g: 100,
        steps: 12000,
        burn_kcal: 2600,
        net_diff: -600,
        water_ml: 2500,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "success");
  });

  it("GET /api/progress returns score", async () => {
    const res = await request(app)
      .get("/api/progress?date=2026-05-15")
      .set(auth);

    assert.equal(res.status, 200);
    assert.ok(res.body.score);
    assert.ok(Array.isArray(res.body.metrics));
  });

  it("rejects missing API token", async () => {
    const res = await request(app).get("/api/daily-log");
    assert.equal(res.status, 401);
  });
});
