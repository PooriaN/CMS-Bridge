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

- `APP_AUTOMATION_TOKEN` for Airtable automation-triggered syncs
- `LOG_LEVEL`
- `PGSSLMODE`
- `PG_POOL_SIZE`

Recommended Vercel setup:

- Framework Preset: `Other`
- Build command: `npm run build`
- Output directory: leave empty
- Install command: `npm ci`

The dashboard and API are served through the Vercel function so the auth gate can protect both.

## Access protection

This deployment is designed to be protected by a shared-password site gate on Vercel Hobby.

- `APP_PASSWORD` controls the shared login password.
- `APP_SESSION_SECRET` signs the session cookie.
- `/api/health` remains public for monitoring.

If either auth variable is missing in production, the app fails closed and blocks access.

## Airtable automation

If you want Airtable Automations to trigger record-level Airtable-to-Webflow syncs, set `APP_AUTOMATION_TOKEN` in Vercel and use a separate secret from the dashboard password.

Use this script pattern in Airtable Automations:

```js
// ── Config ──────────────────────────────────────────────────────────
const CONNECTION_ID = 'your-connection-id';
const CMS_BRIDGE_URL = 'https://cms-bridge.vercel.app';
const CMS_BRIDGE_AUTOMATION_TOKEN = 'your-automation-token';
// ────────────────────────────────────────────────────────────────────

const { recordId } = input.config();
if (!recordId) {
  throw new Error('recordId is missing. Map the Airtable trigger record ID into the script input.');
}

const response = await fetch(`${CMS_BRIDGE_URL}/api/sync/${CONNECTION_ID}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CMS-Bridge-Automation-Token': CMS_BRIDGE_AUTOMATION_TOKEN,
  },
  body: JSON.stringify({
    direction: 'airtable_to_webflow',
    recordIds: [recordId],
  }),
});

const body = await response.text();
const data = JSON.parse(body);

if (!response.ok) {
  throw new Error(`Sync failed (HTTP ${response.status}): ${body}`);
}

console.log(JSON.stringify(data));
```

Automation token rules:

- only `POST /api/sync/:connectionId` accepts the token
- only `direction: "airtable_to_webflow"` is allowed
- `recordIds` must be present and non-empty
- `force` and `dryRun` are rejected for automation-token requests

## Vercel free tier caveat

The app is deployable on Vercel Hobby for manual or on-demand syncs. The in-process scheduler is not used on Vercel, so scheduled syncs are not supported by this setup on the free tier.
