# CMS Bridge

Self-hosted Airtable <-> Webflow CMS sync bridge.

## Local development

1. Install dependencies:

```bash
npm ci
```

2. Start a local Postgres database and create a database named `cms_bridge`.

3. Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
npm run dev
```

The app defaults to `http://0.0.0.0:3456` and exposes a health check at `/api/health`.

## Vercel deployment

This repository includes `vercel.json` and an API catch-all function at `api/[...route].js`.

Required environment variables:

- `AIRTABLE_API_KEY`
- `WEBFLOW_API_TOKEN`
- `DATABASE_URL` or `POSTGRES_URL`
- `APP_PASSWORD`
- `APP_SESSION_SECRET`

Optional environment variables:

- `LOG_LEVEL`
- `PGSSLMODE`
- `PG_POOL_SIZE`

Recommended Vercel setup:

- Framework Preset: `Other`
- Build command: `npm run build`
- Output directory: leave empty
- Install command: `npm ci`

The static dashboard is served from `public/`, and API requests are handled under `/api/*`.

## Access protection

This deployment is designed to be protected by a shared-password site gate on Vercel Hobby.

- `APP_PASSWORD` controls the shared login password.
- `APP_SESSION_SECRET` signs the session cookie.
- `/api/health` remains public for monitoring.

If either auth variable is missing in production, the app fails closed and blocks access.

## Vercel free tier caveat

The app is deployable on Vercel Hobby for manual or on-demand syncs. The in-process scheduler is not used on Vercel, so scheduled syncs are not supported by this setup on the free tier.
