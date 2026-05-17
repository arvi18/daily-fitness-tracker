# Daily Fitness Tracker

A small Node.js app to log daily diet, steps, and calorie balance. Data lives in [Turso](https://turso.tech/) (libSQL). The web UI includes forms, goal tracking, streaks, and weekly charts.

## Features

- **Daily log form** — diet, calories, protein, steps (JSON paste)
- **Goals & gamification** — latest week and month progress, streaks, motivational messages
- **Weekly charts** — steps and intake over the last 7 days
- **REST API** — token-protected, upsert by date
- **Tests** — validation, progress logic, and API smoke tests
- **Deploy-ready** — Docker, Render, and Fly.io configs

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Turso](https://turso.tech/) database and auth token

## Setup

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
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `API_TOKEN` | Secret for `x-api-token` header |

```bash
npm run dev    # development
npm start      # production
npm test       # run tests
```

Open [http://localhost:3000](http://localhost:3000), enter your `API_TOKEN`, and use the dashboard.

## User guide

This section is the day-to-day playbook: how to sign in, paste your log from Gemini, and what each field means.

### Dashboard layout (top to bottom)

| Section | What it does |
|---------|----------------|
| **Authentication** | Enter your API token and refresh the dashboard |
| **Log your day** | Paste JSON and save tonight’s entry |
| **Weekly overview** | Chart of the last 7 days |
| **Latest week** | Goal progress vs last week (if prior data exists) |
| **Latest month** | Goal progress vs last month (if prior data exists) |
| **History** | Past logs, 10 per page; on phones, long diet notes show **More** to expand |
| **Your goals** | Targets for steps, protein, calories, net deficit |

You usually only need **Authentication** and **Log your day** each night. Check the week/month sections when you want a recap.

---

### Authentication (API token)

The API token is a **password you choose** when setting up the app. It is **not** your Turso token.

1. Open `.env` on the machine running the server (or your host’s environment variables when deployed).
2. Set `API_TOKEN` to any long random string you will remember, for example:
   ```
   API_TOKEN=my-secret-evening-log-token-2026
   ```
3. Restart the server (`npm run dev` or redeploy).
4. In the browser, open the app and paste the **same value** into **API token**.
5. Click **Refresh dashboard**.

**Saving the token in your browser**

- The token is stored in this browser for **30 days** (localStorage).
- Use **Clear saved token** if you are on a shared computer.
- **Bitwarden / 1Password / Chrome:** The field is set up as a password field. Save a login for your app URL with:
  - **Username:** `daily-fitness-tracker` (fixed placeholder)
  - **Password:** your `API_TOKEN` value  
  The manager can autofill it next time.

**If requests fail with “Unauthorized”**

- Token in the browser does not match `API_TOKEN` in `.env`.
- Server was not restarted after changing `.env`.
- Typo or extra spaces when copying.

---

### Logging your day (JSON workflow)

Designed for **evening logging**: you summarize the day in Gemini (or any chat), get numbers back as JSON, paste into the app, and save.

#### Step-by-step (every night)

1. **Authentication** — token entered, dashboard refreshed once.
2. **Log your day** — paste JSON into the big text box (starts empty; use **Clear** if you need a fresh box).
3. Click **Save daily log** (`net_diff` is checked automatically; fix in JSON if it does not match intake − burn).
4. Optional: scroll **Latest week** / **History** to confirm.

#### Buttons in “Log your day”

| Button | When to use |
|--------|-------------|
| **Save daily log** | After JSON looks correct — writes to Turso |
| **Fill today** | Sets `"date"` to today (`YYYY-MM-DD`); on an empty box, inserts only `{ "date": "..." }` |
| **Clear** | Empties the text box so you can paste fresh JSON on your phone |

#### Example JSON (copy and edit)

```json
{
  "date": "2026-05-15",
  "diet_summary": "Poha, sandwich, fries, Coke, bhendi. Badminton, bike ride.",
  "intake_kcal": 2200,
  "protein_g": 45,
  "steps": 12802,
  "burn_kcal": 2610,
  "net_diff": -410
}
```

#### Field reference

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `date` | string | Yes | Calendar day for this log, format **`YYYY-MM-DD`** (e.g. `2026-05-15`) |
| `diet_summary` | string | Yes | Free text: what you ate and activity notes |
| `intake_kcal` | integer | Yes | Total calories eaten that day |
| `protein_g` | integer | Yes | Total protein in grams |
| `steps` | integer | Yes | Step count (e.g. from phone/watch) |
| `burn_kcal` | integer | Yes | Estimated calories burned (activity + baseline you use) |
| `net_diff` | integer | Yes | **Must equal** `intake_kcal - burn_kcal` (negative = deficit) |

**Rules the app enforces**

- All calorie/step fields must be **whole numbers** (no decimals).
- `net_diff` must **exactly** match `intake_kcal - burn_kcal`.  
  Example: intake `2200`, burn `2610` → `net_diff` must be **`-410`**.
- Invalid JSON (missing comma, wrong quotes) shows an error before save.

**Same date twice**

- Saving again for the **same `date` overwrites** the previous row (update), it does not add values together.
- To edit a past day, copy values from **History** (today is at the top) into the JSON box and save again with that `date`.

#### Prompt idea for Gemini

You can paste something like this into Gemini at the end of the day:

```text
Summarize my fitness day as JSON only, no markdown, with these exact keys:
date (YYYY-MM-DD), diet_summary, intake_kcal, protein_g, steps, burn_kcal, net_diff.
Use net_diff = intake_kcal - burn_kcal.
Today: [what I ate], steps [N], burn [estimate], protein [estimate].
```

Then copy the JSON block into **Log your day**.

#### Common mistakes

| Problem | Fix |
|---------|-----|
| `net_diff must equal intake_kcal - burn_kcal` | Set `net_diff` to intake minus burn in the JSON |
| `Invalid JSON` | Check trailing commas, double quotes on keys |
| `date must be in YYYY-MM-DD` | Use `2026-05-15`, not `15-05-2026` |
| Save works but UI looks old | Hard refresh: **Ctrl+Shift+R** (cached JavaScript) |
| Unauthorized | Re-check `API_TOKEN` in `.env` vs browser |

---

### Setting goals (optional, once in a while)

At the bottom, **Your goals** defines targets used in **Latest week** and **Latest month**:

| Goal field | Meaning |
|------------|---------|
| Steps target | Hit if daily steps ≥ this |
| Protein target (g) | Hit if daily protein ≥ this |
| Max intake (kcal) | Hit if daily intake ≤ this |
| Net calorie target (kcal) | Hit if `net_diff` ≤ this (e.g. `-300` for a 300 kcal deficit) |

Click **Save goals** after changing them.

## API

Protected routes require:

```
x-api-token: <your API_TOKEN>
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + database ping |
| GET | `/api/goals` | Current goals |
| PUT | `/api/goals` | Update goals |
| GET | `/api/progress/weekly?end=YYYY-MM-DD` | Last 7 days — goal hit rate, averages, messages |
| GET | `/api/progress/monthly?end=YYYY-MM-DD` | Calendar month to date — same stats |
| GET | `/api/summary/weekly?end=YYYY-MM-DD` | 7-day summary for charts |
| POST | `/api/daily-log` | Create or update a log |
| GET | `/api/daily-log` | All logs (newest first) |
| GET | `/api/daily-log/:date` | Single day |

### Goals (PUT `/api/goals`)

```json
{
  "steps_target": 10000,
  "protein_g_target": 100,
  "intake_kcal_max": 2200,
  "net_diff_target": -300
}
```

### Daily log (POST `/api/daily-log`)

```json
{
  "date": "2026-05-15",
  "diet_summary": "Poha, sandwich",
  "intake_kcal": 2200,
  "protein_g": 45,
  "steps": 12802,
  "burn_kcal": 2610,
  "net_diff": -410
}
```

`net_diff` must equal `intake_kcal - burn_kcal`.

## Project structure

```
├── app.js              # Express app (exported for tests)
├── server.js           # Startup + listen
├── db.js               # Turso client + schema
├── lib/
│   ├── validation.js   # Request validation
│   └── progress.js     # Goals, streaks, weekly summary
├── public/
│   ├── index.html
│   └── app.js
├── test/
├── Dockerfile
├── render.yaml
└── fly.toml
```

## Deployment (Render — recommended)

Your repo is already on GitHub with a [`render.yaml`](render.yaml) blueprint. Render runs **Linux + Node**; that matches this app (remote Turso over HTTP, no Windows-only code).

### Step 1 — Open Render Blueprint

1. Sign in at [render.com](https://render.com/) (GitHub login is easiest).
2. Go to **[New Blueprint Instance](https://dashboard.render.com/select-repo?type=blueprint)**.
3. Connect GitHub if asked, then select **`arvi18/daily-fitness-tracker`**.
4. Render reads `render.yaml` and shows one web service: `daily-fitness-tracker`.

### Step 2 — Add environment variables

When prompted, paste the **same values** as your local `.env` (do not commit `.env`):

| Key | Where to get it |
|-----|-----------------|
| `TURSO_DATABASE_URL` | Turso dashboard → your database → connect URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso → database → **Tokens** → create/read token |
| `API_TOKEN` | Any secret string you choose (same one you use in the browser) |

`NODE_ENV=production` is set in `render.yaml` already. Render sets `PORT` automatically.

### Step 3 — Deploy

1. Click **Apply** / **Create**.
2. Wait for build (`npm ci`) and deploy (`npm start`) — usually a few minutes on the free plan.
3. Open the URL Render gives you, e.g. `https://daily-fitness-tracker.onrender.com`.

### Step 4 — Verify

1. Visit `https://YOUR-APP.onrender.com/api/health` — should show `{"status":"ok","database":"ok"}`.
2. Open the app URL, paste your **`API_TOKEN`**, click **Refresh dashboard**.
3. Paste a test JSON and **Save daily log**.

### After deploy

- **Auto-deploy:** Pushes to `main` on GitHub trigger a new deploy (default).
- **Cold start:** Free tier may sleep after ~15 min idle; first load can take 30–60 seconds.
- **Custom domain:** Optional, in Render service → Settings → Custom Domains.

### Manual setup (without Blueprint)

If you prefer not to use the blueprint:

| Setting | Value |
|---------|--------|
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Add the three env vars above in **Environment**.

### Fly.io

```bash
fly launch
fly secrets set TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... API_TOKEN=...
fly deploy
```

### Docker

```bash
docker build -t daily-fitness-tracker .
docker run -p 3000:3000 --env-file .env daily-fitness-tracker
```

## License

MIT
