import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import type { Connection, FieldMapping } from '../types';

export function createConnection(
  data: Omit<Connection, 'id' | 'created_at' | 'updated_at' | 'last_synced_at'>
): Connection {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO connections (id, name, direction, airtable_base_id, airtable_table_id,
      airtable_view_id, webflow_site_id, webflow_collection_id, action_field,
      message_field, sync_time_field, webflow_id_field, airtable_id_slug,
      last_modified_field, cron_schedule, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.direction || null, data.airtable_base_id, data.airtable_table_id,
    data.airtable_view_id || null, data.webflow_site_id, data.webflow_collection_id,
    data.action_field || null, data.message_field || null, data.sync_time_field || null,
    data.webflow_id_field || null, data.airtable_id_slug || null,
    data.last_modified_field || null, data.cron_schedule || null, data.is_active ? 1 : 0,
    now, now
  );

  return getConnection(id)!;
}

export function getConnection(id: string): Connection | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToConnection(row);
}

export function listConnections(): Connection[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM connections ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToConnection);
}

export function updateConnection(id: string, data: Partial<Connection>): Connection | null {
  const db = getDatabase();
  const existing = getConnection(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  const updatable = [
    'name', 'direction', 'airtable_base_id', 'airtable_table_id', 'airtable_view_id',
    'webflow_site_id', 'webflow_collection_id', 'action_field', 'message_field',
    'sync_time_field', 'webflow_id_field', 'airtable_id_slug', 'last_modified_field',
    'cron_schedule', 'is_active', 'last_synced_at'
  ] as const;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = ?`);
      const val = data[key as keyof Connection];
      values.push(key === 'is_active' ? (val ? 1 : 0) : val);
    }
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE connections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getConnection(id);
}

export function deleteConnection(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Field Mappings ─────────────────────────────────────────────

export function setFieldMappings(connectionId: string, mappings: Omit<FieldMapping, 'id' | 'connection_id'>[]): FieldMapping[] {
  const db = getDatabase();

  const deleteStmt = db.prepare('DELETE FROM field_mappings WHERE connection_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO field_mappings (id, connection_id, airtable_field_id, airtable_field_name,
      airtable_field_type, webflow_field_id, webflow_field_slug, webflow_field_type,
      is_name_field, is_slug_field, transform, linked_connection_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    deleteStmt.run(connectionId);
    for (const m of mappings) {
      insertStmt.run(
        uuidv4(), connectionId, m.airtable_field_id, m.airtable_field_name,
        m.airtable_field_type, m.webflow_field_id, m.webflow_field_slug,
        m.webflow_field_type, m.is_name_field ? 1 : 0, m.is_slug_field ? 1 : 0,
        m.transform || null, m.linked_connection_id || null
      );
    }
  });

  transaction();
  return getFieldMappings(connectionId);
}

export function getFieldMappings(connectionId: string): FieldMapping[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM field_mappings WHERE connection_id = ?').all(connectionId) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    connection_id: row.connection_id as string,
    airtable_field_id: row.airtable_field_id as string,
    airtable_field_name: row.airtable_field_name as string,
    airtable_field_type: row.airtable_field_type as FieldMapping['airtable_field_type'],
    webflow_field_id: row.webflow_field_id as string,
    webflow_field_slug: row.webflow_field_slug as string,
    webflow_field_type: row.webflow_field_type as FieldMapping['webflow_field_type'],
    is_name_field: Boolean(row.is_name_field),
    is_slug_field: Boolean(row.is_slug_field),
    transform: row.transform as string | undefined,
    linked_connection_id: row.linked_connection_id as string | undefined,
  }));
}

// ─── Record Map ─────────────────────────────────────────────────

export function getRecordMapping(connectionId: string, airtableId?: string, webflowId?: string) {
  const db = getDatabase();
  type RecordMapRow = { airtable_record_id: string; webflow_item_id: string; last_synced_at: string };
  if (airtableId) {
    return db.prepare('SELECT * FROM record_map WHERE connection_id = ? AND airtable_record_id = ?')
      .get(connectionId, airtableId) as RecordMapRow | undefined;
  }
  if (webflowId) {
    return db.prepare('SELECT * FROM record_map WHERE connection_id = ? AND webflow_item_id = ?')
      .get(connectionId, webflowId) as RecordMapRow | undefined;
  }
  return undefined;
}

export function getAllRecordMappings(connectionId: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM record_map WHERE connection_id = ?').all(connectionId) as {
    id: string; connection_id: string; airtable_record_id: string; webflow_item_id: string; last_synced_at: string;
  }[];
}

export function upsertRecordMapping(connectionId: string, airtableId: string, webflowId: string) {
  const db = getDatabase();
  // Use JS Date.toISOString() (always UTC with "Z") rather than SQLite's
  // datetime('now') which returns "YYYY-MM-DD HH:MM:SS" with no timezone.
  // The bare format is ambiguous — JavaScript parses it as local time —
  // causing the delta-sync comparison to be off by the server's UTC offset.
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO record_map (id, connection_id, airtable_record_id, webflow_item_id, last_synced_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(connection_id, airtable_record_id) DO UPDATE SET
      webflow_item_id = excluded.webflow_item_id,
      last_synced_at = excluded.last_synced_at
  `).run(uuidv4(), connectionId, airtableId, webflowId, now);
}

export function deleteRecordMapping(connectionId: string, airtableId?: string, webflowId?: string) {
  const db = getDatabase();
  if (airtableId) {
    db.prepare('DELETE FROM record_map WHERE connection_id = ? AND airtable_record_id = ?').run(connectionId, airtableId);
  } else if (webflowId) {
    db.prepare('DELETE FROM record_map WHERE connection_id = ? AND webflow_item_id = ?').run(connectionId, webflowId);
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function rowToConnection(row: Record<string, unknown>): Connection {
  return {
    id: row.id as string,
    name: row.name as string,
    direction: row.direction as Connection['direction'],
    airtable_base_id: row.airtable_base_id as string,
    airtable_table_id: row.airtable_table_id as string,
    airtable_view_id: row.airtable_view_id as string | undefined,
    webflow_site_id: row.webflow_site_id as string,
    webflow_collection_id: row.webflow_collection_id as string,
    action_field: row.action_field as string | undefined,
    message_field: row.message_field as string | undefined,
    sync_time_field: row.sync_time_field as string | undefined,
    webflow_id_field: row.webflow_id_field as string | undefined,
    airtable_id_slug: row.airtable_id_slug as string | undefined,
    last_modified_field: row.last_modified_field as string | undefined,
    cron_schedule: row.cron_schedule as string | undefined,
    is_active: Boolean(row.is_active),
    last_synced_at: row.last_synced_at as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
