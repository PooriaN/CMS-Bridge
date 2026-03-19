import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';
import { getDatabase, closeDatabase } from './config/database';
import cron from 'node-cron';
import { listConnections } from './models/connection';
import { runSync } from './services/sync-engine';
import { createLogger } from './utils/logger';

const log = createLogger('app');
const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database
getDatabase();
log.info('Database initialized');

// Start Express server
const app = createServer();
const server = app.listen(PORT, HOST, () => {
  log.info(`CMS Bridge running at http://${HOST}:${PORT}`);
  log.info(`Dashboard: http://${HOST}:${PORT}`);
  log.info(`API:       http://${HOST}:${PORT}/api`);
});

// ─── Scheduled Syncs ────────────────────────────────────────────

const scheduledTasks = new Map<string, cron.ScheduledTask>();

function setupScheduledSyncs() {
  // Clear existing tasks
  for (const task of scheduledTasks.values()) {
    task.stop();
  }
  scheduledTasks.clear();

  const connections = listConnections();
  for (const conn of connections) {
    if (conn.is_active && conn.cron_schedule && cron.validate(conn.cron_schedule)) {
      const task = cron.schedule(conn.cron_schedule, async () => {
        log.info(`Scheduled sync triggered`, { name: conn.name, id: conn.id });
        try {
          // Run AT→WF first (push Airtable changes + action commands to Webflow),
          // then WF→AT (pull any new/changed Webflow items back to Airtable).
          await runSync(conn, { direction: 'airtable_to_webflow' });
          await runSync(conn, { direction: 'webflow_to_airtable' });
        } catch (err) {
          log.error(`Scheduled sync threw an unhandled error`, err instanceof Error ? err : new Error(String(err)));
        }
      });
      scheduledTasks.set(conn.id, task);
      log.info(`Scheduled sync registered`, { name: conn.name, schedule: conn.cron_schedule });
    }
  }
}

setupScheduledSyncs();

// Re-check schedules every 5 minutes
cron.schedule('*/5 * * * *', () => {
  setupScheduledSyncs();
});

// ─── Graceful Shutdown ──────────────────────────────────────────

function shutdown() {
  log.info('Shutting down...');
  for (const task of scheduledTasks.values()) {
    task.stop();
  }
  server.close(() => {
    closeDatabase();
    log.info('Goodbye');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
