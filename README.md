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

## Render deployment

This repository includes a `render.yaml` blueprint that provisions:

- a free Render Postgres database
- a free Node web service
- the `DATABASE_URL` connection string from that database

Required environment variables:

- `AIRTABLE_API_KEY`
- `WEBFLOW_API_TOKEN`

Optional environment variables:

- `LOG_LEVEL`
- `HOST`
- `PORT`
- `PGSSLMODE`

Manual Render settings if you are not using the Blueprint:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- `DATABASE_URL`: your Render Postgres connection string

## Free tier caveat

The app can now run on free Render without a paid disk, but scheduled syncs are not guaranteed on a free web service because free instances can spin down when idle. Manual syncs and on-demand use are the safer fit for the free plan.
