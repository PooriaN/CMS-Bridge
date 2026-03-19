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

// List all connections
router.get('/', (_req, res) => {
  const connections = listConnections();
  res.json({ connections });
});

// Get a single connection
router.get('/:id', (req, res) => {
  const id = req.params.id as string;
  const connection = getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.json({ connection });
});

// Create a connection
router.post('/', (req, res) => {
  try {
    const connection = createConnection(req.body);
    res.status(201).json({ connection });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Update a connection
router.patch('/:id', (req, res) => {
  const id = req.params.id as string;
  const connection = updateConnection(id, req.body);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.json({ connection });
});

// Delete a connection
router.delete('/:id', (req, res) => {
  const id = req.params.id as string;
  const success = deleteConnection(id);
  if (!success) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  res.status(204).send();
});

// ─── Field Mappings ─────────────────────────────────────────────

router.get('/:id/mappings', (req, res) => {
  const id = req.params.id as string;
  const connection = getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  const mappings = getFieldMappings(id);
  res.json({ mappings });
});

router.put('/:id/mappings', (req, res) => {
  const id = req.params.id as string;
  const connection = getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  try {
    const mappings = setFieldMappings(id, req.body.mappings || []);
    res.json({ mappings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// ─── Sync Logs ──────────────────────────────────────────────────

router.get('/:id/logs', (req, res) => {
  const id = req.params.id as string;
  const connection = getConnection(id);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }
  const limit = parseInt(req.query.limit as string) || 20;
  const logs = listSyncLogs(id, limit);
  res.json({ logs });
});

export default router;
