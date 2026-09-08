# Hustl Backend — Run Locally

FastAPI API for sports facilities, pickup games, teams, and tournaments.

Once it is running:

- API: `http://localhost:8000`
- Health: `http://localhost:8000/health`
- Swagger: `http://localhost:8000/docs`

## Prerequisites

- Python 3.14
- [Pipenv](https://pipenv.pypa.io/) — `brew install pipenv` or `pip install pipenv`
- Docker Desktop (for PostgreSQL + PostGIS)

## Run in local (Pipenv)

From the **repository root**:

```bash
cd backend
```

### 1. Start the database

```bash
docker compose up -d
```

Wait until the container is healthy:

```bash
docker compose ps
```

Local Postgres:

| | |
|---|---|
| Host | `localhost:5432` |
| User / password | `postgres` / `postgres` |
| Database | `soccer_app` |

Stop it later with `docker compose down`. Data stays in the `postgres_data` volume unless you add `-v`.

### 2. Create `.env`

```bash
cp .env.example .env
```

The default `DATABASE_URL` already matches the Docker database. Leave `SKIP_DB_INIT=false` so tables are created on first start. Google OAuth and SMTP can stay empty for local use (password-reset OTPs print in the server log).

Do not commit `.env`.

### 3. Install packages

If your terminal is already inside another virtualenv, deactivate it first:

```bash
deactivate
```

Then:

```bash
PIPENV_IGNORE_VIRTUALENVS=1 pipenv install
```

`PIPENV_IGNORE_VIRTUALENVS=1` stops Pipenv from using an empty leftover `env/` or `venv/` folder (that is what causes `uvicorn could not be found`).

### 4. Start the API

```bash
PIPENV_IGNORE_VIRTUALENVS=1 pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/docs` and confirm `GET /health` returns `{"status":"ok"}`.

On first start the app creates the PostGIS extension, tables, and indexes.

## Alternative: venv + pip (no Pipenv)

```bash
cd backend
docker compose up -d
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Do not reuse an old `venv/` or `env/` copied from another folder. Create a new `.venv` in this `backend` directory.

## Local environment

| Variable | Local value | Notes |
|----------|-------------|--------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/soccer_app` | Required. `postgresql://` is rewritten to `+asyncpg`. |
| `JWT_SECRET_KEY` | value from `.env.example` | Fine for local only. Change before any shared deploy. |
| `SKIP_DB_INIT` | `false` | Set `true` only on serverless. |
| Google / SMTP vars | empty | Optional. Needed for real Google login and emailed password resets. |

Connect a phone or emulator on the same Wi-Fi with your machine's LAN IP, not `localhost`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

Uvicorn must stay bound to `0.0.0.0` for that to work.

## Deploy on Vercel

This API deploys as a single [FastAPI Vercel Function](https://vercel.com/docs/frameworks/backend/fastapi). Vercel looks for a FastAPI instance named `app` in `app/main.py` and installs from `requirements.txt`.

The Git repo is a monorepo. The Vercel project **Root Directory must be `backend`**.

Do not put `DATABASE_URL`, JWT keys, OAuth secrets, or SMTP passwords in `vercel.json`. Set them in the Vercel project Environment Variables UI (or `vercel env add`).

### 1. Hosted Postgres with PostGIS

Vercel has no local Docker. Use a hosted Postgres that supports PostGIS (for example [Supabase](https://supabase.com/)).

1. Create a project and a database.
2. Enable the PostGIS extension (`CREATE EXTENSION IF NOT EXISTS postgis;`).
3. Copy the connection string. Either `postgresql://` or `postgresql+asyncpg://` works — `app/database.py` rewrites `postgresql://` to `+asyncpg`.
4. For Supabase, prefer the **transaction pooler** (port `6543`) on serverless. The app already disables prepared-statement caches for PgBouncer.

Initialize tables **once** against that database *before* going live (or after the first deploy, from your laptop):

```bash
cd backend
# point .env DATABASE_URL at the hosted DB
# leave SKIP_DB_INIT=false for this one run
PIPENV_IGNORE_VIRTUALENVS=1 pipenv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Hit `http://127.0.0.1:8000/health`, then stop the server. On Vercel, `SKIP_DB_INIT` must be `true` so cold starts do not run `CREATE TABLE`.

### 2. Create the Vercel project (Git)

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Open [vercel.com/new](https://vercel.com/new) and import the repo.
3. Set **Root Directory** to `backend` (Edit → `backend`). Leave the frontend as a separate Vercel project if you deploy it there.
4. Framework / build: Vercel should detect FastAPI. You do **not** need a Build Command or Output Directory.
5. Do not deploy yet — add environment variables first.

### 3. Environment variables (Vercel dashboard)

Project → **Settings → Environment Variables**. Add these for **Production** and **Preview**:

| Variable | Required | Value |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Hosted Postgres URL (pooler URL on Supabase) |
| `JWT_SECRET_KEY` | Yes | New secret, not the local placeholder. `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SKIP_DB_INIT` | Yes | `true` |
| `GOOGLE_WEB_CLIENT_ID` | For Google login | Same web client as the app |
| `GOOGLE_IOS_CLIENT_ID` | For Google login | iOS client ID |
| `GOOGLE_ANDROID_CLIENT_ID` | For Google login | Android client ID |
| `GOOGLE_CLIENT_SECRET` | If using `/auth/google/callback` | Web client secret |
| `GOOGLE_REDIRECT_URI` | If using the callback flow | Must match Google Cloud Console |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | For emailed password resets | Leave unset to skip email |

After adding vars, trigger a new deployment so they take effect.

### 4. Deploy

From the dashboard: **Deploy** (or push to the connected git branch).

Or from your machine, with [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`):

```bash
cd backend
vercel link          # first time: pick the team/project, root = backend
vercel env pull      # optional: write Vercel env into .env.local
vercel               # preview
vercel --prod        # production
```

Production URL looks like `https://<project>.vercel.app`.

### 5. Confirm the deploy

```bash
curl https://<project>.vercel.app/health
```

Expect `{"status":"ok"}`. Then open `https://<project>.vercel.app/docs`.

Point the Expo app at that origin (no trailing slash):

```
EXPO_PUBLIC_API_URL=https://<project>.vercel.app
```

Add the Vercel URL to any Google OAuth authorized origins / redirect URIs.

### 6. What this repo already has

| File | Role on Vercel |
|------|----------------|
| `app/main.py` | Entrypoint. Exports `app = FastAPI(...)`. |
| `requirements.txt` | Install list. Vercel does **not** use Pipenv on the build. |
| `vercel.json` | Routes every path to `app/main.py`. Keep `SKIP_DB_INIT` and secrets **out** of this file — use the dashboard. |
| `Dockerfile.vercel` | Optional container image (native deps: `libpq`, `libgeos`). Use only if the Python Function build fails on `shapely` / `asyncpg`. |

Nearby-place calls hit Overpass/Nominatim and can exceed the default function timeout. If you see 504s, set `maxDuration` on the entrypoint in `vercel.json`:

```json
{
  "functions": {
    "app/main.py": {
      "maxDuration": 60
    }
  }
}
```

Hobby plans cap duration; Pro allows up to 60–300s depending on the plan.

### Vercel troubleshooting

**Build cannot find FastAPI / wrong app**

Root Directory is not `backend`, or the project was created from the repo root. Fix Root Directory and redeploy.

**Function boots then 500s on DB**

`DATABASE_URL` missing, wrong, or SSL/pooler mismatch. Check Vercel **Logs**. Supabase needs SSL (the app enables it when the host contains `supabase`). Confirm PostGIS exists and tables were created with `SKIP_DB_INIT=false` once.

**Cold start creates / alters tables every time**

`SKIP_DB_INIT` is not `true` in the Vercel environment for that deployment.

**`shapely` / `asyncpg` build failure**

The serverless Python build could not compile native wheels. Use `Dockerfile.vercel` as the project Dockerfile, or pin versions that publish `manylinux` wheels.

## Troubleshooting

**`the command uvicorn could not be found within PATH or Pipfile's scripts`**

```bash
deactivate
cd backend
PIPENV_IGNORE_VIRTUALENVS=1 pipenv install
PIPENV_IGNORE_VIRTUALENVS=1 pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Cannot connect to the database**

```bash
docker compose ps
docker compose logs db
```

Confirm Docker is running and port `5432` is free. `DATABASE_URL` must use `localhost` and the compose user/password above.

**Port 8000 already in use**

```bash
PIPENV_IGNORE_VIRTUALENVS=1 pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```
