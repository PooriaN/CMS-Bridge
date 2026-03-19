import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import type { SyncLog, SyncError, SyncDirection, SyncStatus } from '../types';

export function createSyncLog(connectionId: string, direction: SyncDirection): SyncLog {
  const db = getDatabase();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO sync_logs (id, connection_id, status, direction, started_at)
    VALUES (?, ?, 'running', ?, datetime('now'))
  `).run(id, connectionId, direction);

  return getSyncLog(id)!;
}

export function updateSyncLog(
  id: string,
  data: {
    status?: SyncStatus;
    records_processed?: number;
    records_created?: number;
    records_updated?: number;
    records_deleted?: number;
    records_failed?: number;
    errors?: SyncError[];
  }
): SyncLog | null {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.records_processed !== undefined) { fields.push('records_processed = ?'); values.push(data.records_processed); }
  if (data.records_created !== undefined) { fields.push('records_created = ?'); values.push(data.records_created); }
  if (data.records_updated !== undefined) { fields.push('records_updated = ?'); values.push(data.records_updated); }
  if (data.records_deleted !== undefined) { fields.push('records_deleted = ?'); values.push(data.records_deleted); }
  if (data.records_failed !== undefined) { fields.push('records_failed = ?'); values.push(data.records_failed); }
  if (data.errors !== undefined) { fields.push('errors = ?'); values.push(JSON.stringify(data.errors)); }

  if (data.status === 'completed' || data.status === 'failed' || data.status === 'partial') {
    fields.push("completed_at = datetime('now')");
  }

  if (fields.length === 0) return getSyncLog(id);

  values.push(id);
  db.prepare(`UPDATE sync_logs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getSyncLog(id);
}

export function getSyncLog(id: string): SyncLog | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sync_logs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSyncLog(row);
}

export function listSyncLogs(connectionId: string, limit = 20): SyncLog[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM sync_logs WHERE connection_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(connectionId, limit) as Record<string, unknown>[];
  return rows.map(rowToSyncLog);
}

function rowToSyncLog(row: Record<string, unknown>): SyncLog {
  return {
    id: row.id as string,
    connection_id: row.connection_id as string,
    status: row.status as SyncStatus,
    direction: row.direction as SyncDirection,
    records_processed: row.records_processed as number,
    records_created: row.records_created as number,
    records_updated: row.records_updated as number,
    records_deleted: row.records_deleted as number,
    records_failed: row.records_failed as number,
    errors: JSON.parse((row.errors as string) || '[]') as SyncError[],
    started_at: row.started_at as string,
    completed_at: row.completed_at as string | undefined,
  };
}
