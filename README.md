# Daily Fitness Tracker

Log daily diet, steps, and calorie balance to [Turso](https://turso.tech/) (libSQL). Web UI: JSON paste, goal tracking, week/month progress, streaks, charts. Token-protected REST API. Deploy via Render (`render.yaml`), Docker, or Fly.io.

## Quick start

**Prerequisites:** Node.js 18+, Turso database + auth token.

```bash
git clone https://github.com/arvi18/daily-fitness-tracker.git
cd daily-fitness-tracker
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `TURSO_DATABASE_URL` | e.g. `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso database token |
| `API_TOKEN` | Secret for `x-api-token` (browser + API; **not** the Turso token) |

```bash
npm run dev    # development
npm start      # production
npm test
```

Open [http://localhost:3000](http://localhost:3000), paste `API_TOKEN`, click **Refresh dashboard**.

**Dependencies:** Commit `package-lock.json` and use `npm ci` in production. Upgrade deps deliberately—review lockfile diffs and run `npm audit` + `npm test`.

## Using the app

Nightly flow: get JSON from Gemini → paste → **Save daily log**. You usually only need **Authentication** and **Log your day**; use week/month/history for recaps.

| Section | Purpose |
|---------|---------|
| **Authentication** | API token + refresh |
| **Log your day** | Paste JSON, save (empty box by default; **Clear** / **Fill today**) |
| **Weekly overview** | Last 7 days chart |
| **Latest week / month** | Goal progress vs prior period when data exists |
| **History** | Paginated logs; mobile: **More** on long diet notes |
| **Your goals** | Steps, protein, max intake, net calorie targets |

### API token

1. Set `API_TOKEN` in `.env` (or host env vars), restart server.
2. Paste the same value in the browser; **Refresh dashboard**.
3. Stored in this browser for **30 days**; **Clear saved token** on shared devices.
4. Password managers: username `daily-fitness-tracker`, password = your `API_TOKEN`.

**Unauthorized?** Browser token ≠ `.env`, server not restarted, or typo/extra spaces.

### Daily log JSON

| Button | Action |
|--------|--------|
| **Save daily log** | Upsert to Turso (`net_diff` must equal intake − burn) |
| **Fill today** | Sets `date` to today; empty box → `{ "date": "YYYY-MM-DD" }` only |
| **Clear** | Empty the text box |

```json
{
  "date": "2026-05-15",
  "diet_summary": "Poha, sandwich. Badminton.",
  "intake_kcal": 2200,
  "protein_g": 45,
  "steps": 12802,
  "burn_kcal": 2610,
  "net_diff": -410
}
```

| Field | Notes |
|-------|--------|
| `date` | `YYYY-MM-DD` |
| `diet_summary` | Free text |
| `intake_kcal`, `protein_g`, `steps`, `burn_kcal` | Integers |
| `net_diff` | Must equal `intake_kcal - burn_kcal` |

Same `date` **overwrites** (no summing). Edit past days via **History** → paste into JSON box → save.

**Gemini prompt (optional):**

```text
Summarize my fitness day as JSON only, no markdown, keys:
date (YYYY-MM-DD), diet_summary, intake_kcal, protein_g, steps, burn_kcal, net_diff.
net_diff = intake_kcal - burn_kcal.
Today: [food], steps [N], burn [estimate], protein [estimate].
```

| Problem | Fix |
|---------|-----|
| `net_diff must equal…` | Fix math in JSON |
| `Invalid JSON` | Quotes, commas |
| `date must be YYYY-MM-DD` | e.g. `2026-05-15` |
| Stale UI | Hard refresh (Ctrl+Shift+R) |
| Unauthorized | Match `.env` and browser token |

### Goals

| Field | Hit when |
|-------|----------|
| Steps target | steps ≥ target |
| Protein (g) | protein ≥ target |
| Max intake (kcal) | intake ≤ max |
| Net (kcal) | `net_diff` ≤ target (e.g. `-300`) |

## API

Header: `x-api-token: <API_TOKEN>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + DB ping |
| GET/PUT | `/api/goals` | Read/update goals |
| GET | `/api/progress/weekly?end=YYYY-MM-DD` | Last 7 days stats |
| GET | `/api/progress/monthly?end=YYYY-MM-DD` | Month-to-date stats |
| GET | `/api/summary/weekly?end=YYYY-MM-DD` | Chart data |
| POST | `/api/daily-log` | Create/update log (body = JSON above) |
| GET | `/api/daily-log` | All logs |
| GET | `/api/daily-log/:date` | Single day |

## Deploy (Render)

1. [New Blueprint](https://dashboard.render.com/select-repo?type=blueprint) → repo `arvi18/daily-fitness-tracker`.
2. Env vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `API_TOKEN` (same as local `.env`). `NODE_ENV` and `PORT` are handled by Render/`render.yaml`.
3. Build: `npm ci` · Start: `npm start` · Health: `/api/health`.
4. Verify: `/api/health` → `{"status":"ok","database":"ok"}`; sign in and save a test log.

Pushes to `main` auto-deploy. Free tier may cold-start (~30–60s after idle).

**Without blueprint:** Web service, same build/start/health, same three env vars.

**Fly.io:** `fly launch` → `fly secrets set TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... API_TOKEN=...` → `fly deploy`

**Docker:** `docker build -t daily-fitness-tracker .` then `docker run -p 3000:3000 --env-file .env daily-fitness-tracker`

## Project layout

```
├── app.js, server.js, db.js
├── lib/validation.js, lib/progress.js
├── public/index.html, public/app.js
├── test/
├── render.yaml, Dockerfile, fly.toml, railway.toml
```

## License

MIT
