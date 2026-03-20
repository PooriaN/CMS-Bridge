import { Router } from 'express';
import {
  createConnection,
  getConnection,
  listConnections,
  updateConnection,
  deleteConnection,
  setFieldMappings,
  getFieldMappings,
} from '../models/connection';
import { listSyncLogs } from '../models/sync-log';

const router = Router();

router.get('/', async (_req, res) => {
  const connections = await listConnections();
  res.json({ connections });
});

router.get('/:id', async (req, res) => {
  const id = req.params.id as string;
  const connection = await getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.json({ connection });
});

router.post('/', async (req, res) => {
  try {
    const connection = await createConnection(req.body);
    res.status(201).json({ connection });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

router.patch('/:id', async (req, res) => {
  const id = req.params.id as string;
  const connection = await updateConnection(id, req.body);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.json({ connection });
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id as string;
  const success = await deleteConnection(id);
  if (!success) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.status(204).send();
});

router.get('/:id/mappings', async (req, res) => {
  const id = req.params.id as string;
  const connection = await getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  const mappings = await getFieldMappings(id);
  res.json({ mappings });
});

router.put('/:id/mappings', async (req, res) => {
  const id = req.params.id as string;
  const connection = await getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  try {
    const mappings = await setFieldMappings(id, req.body.mappings || []);
    res.json({ mappings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

router.get('/:id/logs', async (req, res) => {
  const id = req.params.id as string;
  const connection = await getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const logs = await listSyncLogs(id, limit);
  res.json({ logs });
});

export default router;
