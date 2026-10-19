# ExpenseTracker

A full-stack expense tracker:

- **`backend/`** — Express 5 + Mongoose (MongoDB) REST API with JWT auth
- **`frontend/expense-tracker/`** — React 19 + Vite 8 + Tailwind CSS 4 SPA

The backend serves the compiled frontend in production, so the whole app can be
deployed as a single service.

## Quick start (local)

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/expense-tracker/.env.example frontend/expense-tracker/.env
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8000

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for the full guide:

- **Render + MongoDB Atlas** (recommended, single service) — `render.yaml` is a
  ready-to-use blueprint
- **Split deploy** — Netlify/Vercel for the frontend, Render for the API
- **Docker** — a `Dockerfile` is included

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and the Vite dev server together |
| `npm run dev:backend` | API only (port 8000) |
| `npm run dev:frontend` | Frontend only (port 5173) |
| `npm --prefix backend start` | Production API server |
| `npm --prefix frontend/expense-tracker run build` | Production frontend build → `dist/` |
