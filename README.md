# Daily Fitness Tracker

A small Node.js app to log daily diet, steps, water, and calorie balance. Data lives in [Turso](https://turso.tech/) (libSQL). The web UI includes forms, goal tracking, streaks, and weekly charts.

## Features

- **Daily log form** — diet, calories, protein, steps, water
- **Goals & gamification** — progress bars, motivational messages, logging / full-goal streaks
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
| GET | `/api/progress?date=YYYY-MM-DD` | Day progress, metrics, messages, streaks |
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
  "net_diff_target": -300,
  "water_ml_target": 2500
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
  "net_diff": -410,
  "water_ml": 2500
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

## Deployment

### Render

1. Connect the GitHub repo in [Render](https://render.com/).
2. Use the included `render.yaml` or set build `npm ci` and start `npm start`.
3. Add env vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `API_TOKEN`.

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
