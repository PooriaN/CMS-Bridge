import { Router } from 'express';
import { getConnection } from '../models/connection';
import { getSyncLog } from '../models/sync-log';
import { runSync } from '../services/sync-engine';

const router = Router();

const runningSyncs = new Set<string>();

router.post('/:connectionId', async (req, res) => {
  const connectionId = req.params.connectionId as string;
  const connection = await getConnection(connectionId);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }

  if (!connection.is_active) {
    res.status(400).json({ error: 'Connection is not active' });
    return;
  }

  if (runningSyncs.has(connection.id)) {
    res.status(409).json({ error: 'A sync is already running for this connection' });
    return;
  }

  const direction = req.body.direction as string | undefined;
  if (direction !== 'airtable_to_webflow' && direction !== 'webflow_to_airtable') {
    res.status(400).json({ error: 'direction must be "airtable_to_webflow" or "webflow_to_airtable"' });
    return;
  }

  const dryRun = req.body.dryRun === true;
  const recordIds = req.body.recordIds as string[] | undefined;

  runningSyncs.add(connection.id);

  try {
    const log = await runSync(connection, { direction, dryRun, recordIds });
    const result = await getSyncLog(log.id);
    res.json({ sync: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  } finally {
    runningSyncs.delete(connection.id);
  }
});

router.get('/status/:logId', async (req, res) => {
  const logId = req.params.logId as string;
  const log = await getSyncLog(logId);
  if (!log) {
    res.status(404).json({ error: 'Sync log not found' });
    return;
  }
  res.json({ sync: log });
});

export default router;
