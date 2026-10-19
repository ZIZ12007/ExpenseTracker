# Deploying ExpenseTracker

A MERN app: an Express 5 + MongoDB API in `backend/`, and a React 19 + Vite
frontend in `frontend/expense-tracker/`.

The backend serves the compiled frontend (`backend/server.js` mounts
`frontend/expense-tracker/dist` and has an SPA fallback), so the simplest and
most reliable setup is **one service** that serves both the API and the app.

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

**Uploads:** Vercel's filesystem is read-only, so uploaded images fall back
to the function's temp directory and are lost when the instance recycles. Add
the three Cloudinary variables to make avatars permanent.

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
