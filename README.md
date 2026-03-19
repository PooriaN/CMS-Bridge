# CMS Bridge

Self-hosted Airtable <-> Webflow CMS sync bridge.

## Local development

1. Install dependencies:

```bash
npm ci
```

2. Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm run dev
```

The app defaults to `http://0.0.0.0:3456` and exposes a health check at `/api/health`.

## Render deployment

This repository includes a `render.yaml` blueprint for Render.

Render configuration:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Persistent disk mount: `/var/data`
- Production database path: `/var/data/cms-bridge.db`

Required environment variables:

- `AIRTABLE_API_KEY`
- `WEBFLOW_API_TOKEN`

Optional environment variables:

- `LOG_LEVEL`
- `HOST`
- `PORT`
- `DB_PATH`

If you deploy manually instead of using the blueprint, make sure the service:

- listens on `0.0.0.0`
- has a persistent disk attached
- stores SQLite on that disk instead of the ephemeral filesystem
