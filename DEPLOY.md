# Deploying ExpenseTracker

A MERN app: an Express 5 + MongoDB API in `backend/`, and a React 19 + Vite
frontend in `frontend/expense-tracker/`.

The backend serves the compiled frontend (`backend/server.js` mounts
`frontend/expense-tracker/dist` and has an SPA fallback), so the simplest and
most reliable setup is **one service** that serves both the API and the app.

---

## Features

| Feature | What it does | Needs |
| --- | --- | --- |
| **Google sign in** | "Continue with Google" on the login and sign up pages. A Google account creates the account and is treated as already verified. | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| **Email sign in link** | No password needed: the app emails a one time link that signs you in. New addresses get an account automatically. | `RESEND_API_KEY` |
| **Email verification** | A link is emailed after signing up with a password. The app works without it, but shows a reminder banner and the account can request a new link. | `RESEND_API_KEY` (emails are logged when it is missing) |
| **Password recovery** | "Forgot your password" emails a link that works for an hour. The account can also change its password in Settings. | `RESEND_API_KEY` |
| **Usernames** | Every account can set a short unique handle, changed from Settings. | - |
| **Settings** | Profile, currency, daily allowance, notifications, password and sign out. | - |
| **Naira by default** | Amounts are shown in ₦. The currency can be changed per user. | - |
| **Onboarding tour** | A five step guided tour with a pointer, shown once to new accounts. | - |
| **Budget and meals** | Set a daily allowance, list recurring costs, and see what is left for food. | - |
| **Timetable** | Upload a photo of the school food timetable and the meals are read from it. | `GEMINI_API_KEY` (upload still works without it) |
| **Food suggestions** | A meal plan that fits the remaining daily budget. | `GEMINI_API_KEY` (a rule based planner is used without it) |

### Email setup, in full

Resend's free tier sends 3,000 emails a month, but a new account can only
send **to its own address** until a domain is verified. To email real users:

1. Add your domain at [resend.com/domains](https://resend.com/domains).
2. Add the three DNS records it gives you (usually on Cloudflare, which is
   where this app's domain is).
3. Set `MAIL_FROM` to an address on that domain, for example
   `Expense Tracker <noreply@yourdomain.com>`.

Until then the app still works - emails simply do not go out to anyone but
you, and the link is written to the server log.

### AI setup

`GEMINI_API_KEY` comes from [Google AI Studio](https://aistudio.google.com/apk-key).

The free tier is generous but not unlimited, and the limits differ per model -
some are as low as 20 requests a day, and a model can be busy or retired at
any time. The app therefore tries several models in turn, remembers the one
that worked, and falls back to its own rule based planner if none answer. A
plan is always produced.

For dependable AI, enable billing on the AI Studio project: that moves it to
the Tier 1 limits, which are far higher, and it is billed only for what you
use.

### Google sign in setup

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type *Web application*.
2. Add the redirect URI: `https://<your-domain>/api/v1/auth/google/callback`
3. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The button only appears once both are set, so the app is safe to deploy before
the credentials exist.

### AI setup

`GEMINI_API_KEY` comes from [Google AI Studio](https://aistudio.google.com/apk-key).
The free tier allows roughly 1,500 requests a day with no credit card, which
covers a few hundred users asking for a plan once or twice a day. Without a
key the app uses its own rule based planner, so the feature never breaks.

---

## Option A (recommended): Render + MongoDB Atlas

> **Before you start:** a Render workspace needs a payment method on file
> (`dashboard.render.com/billing`) before it will build *anything*. The free
> web service still costs $0 — the card is only used to verify the account.
> Without it, every deploy fails in ~15 seconds with `build_failed` and no
> build log, and creating a service returns
> `402 Payment information is required`.

### 1. Database — MongoDB Atlas (free M0)

1. Create a free cluster.
2. **Database Access** → add a user with a username and password.
3. **Network Access** → *Allow access from anywhere* (`0.0.0.0/0`).
   Render's outbound IPs are not static, so an IP allowlist will break the
   connection.
4. Copy the connection string and add the database name:

   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/expensetracker?retryWrites=true&w=majority
   ```

### 2. Push the code

This repo has no `.git` folder, so push it to your own GitHub account:

```bash
cd ExpenseTracker
git init
git add .
git commit -m "Prepare ExpenseTracker for deployment"
git branch -M main
git remote add origin https://github.com/<you>/ExpenseTracker.git
git push -u origin main
```

### 3. Create the service

**Render → New → Blueprint → select your repo.** Render reads `render.yaml`
and asks for the two `sync: false` variables:

| Variable | Value |
| --- | --- |
| `MONGO_URL` | the Atlas connection string from step 1 |
| `JWT_SECRET` | a long random string, e.g. `openssl rand -hex 32` |
| `CLIENT_URL` | leave empty for a single-service deploy |

Render then builds the frontend, starts the backend, and gives you a URL like
`https://expensetracker.onrender.com`.

> Free plan note: the service sleeps after ~15 minutes of inactivity, and the
> first request after that takes 30–60 seconds.

### 4. Uploaded images need a persistent disk

`backend/uploads/` is on the container's local disk, so profile photos are
lost on every redeploy and whenever the free instance restarts. Two options:

**Option A — Cloudinary (free, recommended).** No code change is needed; the
app switches automatically once these three environment variables are set on
the service:

```
CLOUDINARY_CLOUD_NAME = <from console.cloudinary.com/settings/api-keys>
CLOUDINARY_API_KEY    = <key>
CLOUDINARY_API_SECRET = <secret>
```

Uploads are then signed server-side and stored in Cloudinary, so the URLs keep
working across every redeploy. `CLOUDINARY_FOLDER` (default
`expensetracker/avatars`) and `CLOUDINARY_PUBLIC_ID_PREFIX` are optional.

**Option B — a Render persistent disk** (paid plans): mount it at
`/opt/render/project/src/backend/uploads`.

Without either, uploads still work — they are just stored on the instance's
local disk and disappear on the next deploy.

---

## Option B: split deploy (Netlify/Vercel frontend + Render backend)

Use this only if you want the frontend on a CDN.

### Backend (Render)

Create a **Web Service** (not a Blueprint) with:

- Root directory: repository root
- Build command:
  ```
  npm install && npm --prefix backend install --omit=dev
  ```
- Start command:
  ```
  npm --prefix backend start
  ```
- Environment: `MONGO_URL`, `JWT_SECRET`, `CLIENT_URL` (see below)

### Frontend (Netlify)

`netlify.toml` is already configured (base directory: repository root,
publish directory: `frontend/expense-tracker/dist`). Add the env var in the
Netlify UI under **Site configuration → Environment variables**:

```
VITE_API_URL = https://expensetracker.onrender.com
```

And on the backend, set `CLIENT_URL=https://<your-site>.netlify.app` so CORS
accepts the frontend origin.

**Vercel** instead of Netlify: import the repo, set the root directory to
`frontend/expense-tracker`, framework preset **Vite**, and add the same
`VITE_API_URL` env var.

---

## Option D: Vercel (serverless, no card required)

Vercel's free Hobby tier runs the whole app — API and frontend — from a
single project, with no credit card.

How it works: `api/index.js` exports the Express app as a request handler
(the app is also exported from `backend/server.js` so it can run as a normal
server elsewhere), Vercel serves the built frontend as static files, and
`vercel.json` routes `/api/*` to the function and everything else to
`index.html`.

```bash
npm i -g vercel
vercel --token <token>            # link a project
vercel --token <token> deploy --prod
```

Environment variables (set with `vercel env add <name> <value>` or in the
dashboard):

| Variable | Value |
| --- | --- |
| `MONGO_URL` | your Atlas connection string |
| `JWT_SECRET` | a long random string |
| `NODE_ENV` | `production` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | optional, but see below |

### Automatic deployments

There are two ways to deploy on every push to `main`.

**Option 1 - the Vercel GitHub App (recommended, one click).**
Install the app for the repository at <https://github.com/apps/vercel>, then
connect the repo in the Vercel dashboard under **Settings → Git → Connect
Repository**. Every push to `main` then deploys automatically, and every pull
request gets a preview URL.

**Option 2 - GitHub Actions.**
Copy `deploy/vercel-github-actions.yml` to `.github/workflows/deploy.yml` and
push it. The repository already has the three secrets it needs
(`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`).
Note: pushing a workflow file requires a personal access token with the
`workflow` scope; a token without it is rejected by GitHub.

**Uploads:** Vercel's filesystem is read-only, so uploaded images fall back
to the function's temp directory and are lost when the instance recycles. Add
the three Cloudinary variables to make avatars permanent.

## Scaling

### What the app does at scale (tuned for ~200 users)

| Area | What was done |
| --- | --- |
| Database | Compound indexes on `{ userId, date }` and `{ userId, source/category }`, created explicitly at startup |
| Dashboard | 9 separate queries reduced to **2** (one `$facet` aggregation per collection) |
| Transaction lists | Paginated (`?page=`, `?limit=`, default 50, max 200) with server-side search, in a single query |
| Response size | Only the fields the UI renders are projected; lists are no longer unbounded |
| Connection pool | `maxPoolSize: 5` per instance instead of Mongoose's default of 100 |
| Caching | Short-lived in-memory cache for the dashboard and for the auth lookup, invalidated on writes |
| Sessions | 7-day access token plus a rotating refresh token, so users stop re-authenticating hourly |
| Protection | Rate limiting (600 requests / 5 min per IP, 40 / 15 min for auth) and gzip compression |
| Resilience | A failed database connection is retried on the next request instead of leaving the instance stuck |

The auth rate limit is counted **in the database**, not in memory. An in-memory
counter only sees the requests that reach one process, which on a serverless
host means an attacker can spread requests across instances; one write per
attempt keeps the limit global.

Two budgets are enforced: a strict one **per account** (which is what stops a
password being guessed) and a generous one **per IP** (which stops one client
spraying many accounts). Splitting them this way means people who share an IP
- a campus, an office, a mobile carrier - are not locked out of their own
account by a stranger's failed attempts.

Measured with 200 simulated users and 60,000 transactions (800 requests, 50 concurrent):

| | With indexes | Without indexes |
| --- | --- | --- |
| Throughput | 186 req/s | 57 req/s |
| p50 latency | 166 ms | 608 ms |
| p95 latency | 217 ms | 800 ms |
| Database queries per request | 1.5 | 9 on the dashboard alone (old code) |

### Tuning knobs

All optional - the defaults suit a small production app.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGO_MAX_POOL_SIZE` | `5` | Connections per instance. Keep the total under the cluster's connection limit. |
| `MONGO_MIN_POOL_SIZE` | `0` | Idle connections to keep open. |
| `MONGO_WAIT_QUEUE_TIMEOUT_MS` | `5000` | How long a request waits for a free connection. |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | `10000` | How long to wait for a reachable server. |
| `DASHBOARD_CACHE_TTL_MS` | `15000` | How long a dashboard result is reused. Writes invalidate it immediately. |
| `USER_CACHE_TTL_MS` | `60000` | How long the authenticated user record is cached. |
| `CACHE_MAX_ENTRIES` | `500` | Maximum cached entries per instance. |
| `RATE_LIMIT_API_MAX` | `600` | Requests per 5 minutes per IP. |
| `RATE_LIMIT_AUTH_MAX` | `10` | Failed attempts per 15 minutes **per account**. |
| `RATE_LIMIT_AUTH_IP_MAX` | `100` | Auth attempts per 15 minutes **per IP**. |
| `JWT_EXPIRES_IN` | `7d` | Access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token lifetime. |

### When to upgrade the database

The free Atlas (M0) cluster allows **100 database operations per second** and
**500 concurrent connections**, and it is a shared single-node cluster with no
backups.

A realistic 200-user workload (say 20 requests per user per day) uses about
0.1 operations per second, so the free tier is comfortable. What the free tier
cannot absorb is a *synchronised burst* - everyone refreshing at the same
moment - because each request costs 1.5 operations.

Upgrading to **M10 ($5/month)** removes that ceiling and adds a dedicated
cluster plus automatic backups. Note that a tier cannot be changed in place:
you create a new cluster and migrate.

### Beyond ~1,000 users

- A read replica for the dashboard aggregations
- A shared cache (Redis) instead of the in-process one, so all instances share it
- Moving the Excel export to a background job - it is generated in memory
- Atlas Search if the transaction list needs full-text search

---

## Option E: Docker

```bash
docker build -t expensetracker .
docker run -p 8000:8000 \
  -e MONGO_URL="mongodb+srv://..." \
  -e JWT_SECRET="..." \
  -v expensetracker_uploads:/app/backend/uploads \
  expensetracker
```

The image builds the frontend in one stage and runs the API + static app in
another. Mount a volume at `/app/backend/uploads` to keep uploaded images.

---

## Local development

```bash
npm install
cp backend/.env.example backend/.env          # set MONGO_URL, JWT_SECRET
cp frontend/expense-tracker/.env.example frontend/expense-tracker/.env
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

`VITE_API_URL=http://localhost:8000` is required locally: the frontend
defaults to calling the API on its own origin and `vite.config.js` defines no
dev proxy.

If MongoDB is unreachable the backend starts an in-memory MongoDB
(`mongodb-memory-server`); data is discarded on restart, so do not rely on it.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Every deploy fails in ~15s with `build_failed` and no build output | The Render workspace has no payment method on file. Add a card at `dashboard.render.com/billing`. The free tier still costs $0. |
| `402 Payment information is required` when creating a service | Same as above — billing is not enabled on the workspace. |
| `TypeError: Missing parameter name` on startup | Express 5 requires named wildcards. The SPA route must be `app.get("/{*splat}", ...)`, not `app.get("*", ...)`. |
| `sh: vite: not found` during build | The host set `NODE_ENV=production`, so npm skipped devDependencies. Use `npm install --include=dev` for the frontend. |
| `stream did not contain valid UTF-8` during build | A source file is stored as UTF-16 (with a BOM) instead of UTF-8. `src/utils/axiosInstance.js` was; it has been converted. |
| `Cannot resolve './axiosinstance'` on Linux | Import casing must match the file name exactly on case-sensitive hosts. `uploadImage.js` now imports `./axiosInstance`. |
| `503 Database unavailable` | `MONGO_URL` is wrong, or the Atlas network access list does not allow Render. |
| `Server configuration error` / 500 on login | `JWT_SECRET` is not set. |
| Image upload fails with `ENOENT` | The `uploads` directory did not exist. `backend/server.js` now creates it on boot. |
| Images load over `http://` (blocked as mixed content) | The proxy is not trusted. `app.set("trust proxy", true)` is now set in `backend/server.js`. |
| Frontend loads but every API call 404s | `VITE_API_URL` is not set for a split deploy, or the backend is not running. |
| Unknown API route returns the HTML app | Fixed: the SPA fallback now skips `/api/*` and `/uploads/*` and lets them 404 as JSON. |
