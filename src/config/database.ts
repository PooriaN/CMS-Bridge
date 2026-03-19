import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || './data/cms-bridge.db';
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('airtable_to_webflow', 'webflow_to_airtable')),
      airtable_base_id TEXT NOT NULL,
      airtable_table_id TEXT NOT NULL,
      airtable_view_id TEXT,
      webflow_site_id TEXT NOT NULL,
      webflow_collection_id TEXT NOT NULL,
      action_field TEXT,
      cron_schedule TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS field_mappings (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      airtable_field_id TEXT NOT NULL,
      airtable_field_name TEXT NOT NULL,
      airtable_field_type TEXT NOT NULL,
      webflow_field_id TEXT NOT NULL,
      webflow_field_slug TEXT NOT NULL,
      webflow_field_type TEXT NOT NULL,
      is_name_field INTEGER NOT NULL DEFAULT 0,
      is_slug_field INTEGER NOT NULL DEFAULT 0,
      transform TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS record_map (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      airtable_record_id TEXT NOT NULL,
      webflow_item_id TEXT NOT NULL,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      UNIQUE(connection_id, airtable_record_id),
      UNIQUE(connection_id, webflow_item_id)
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'partial')),
      direction TEXT NOT NULL,
      records_processed INTEGER NOT NULL DEFAULT 0,
      records_created INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_deleted INTEGER NOT NULL DEFAULT 0,
      records_failed INTEGER NOT NULL DEFAULT 0,
      errors TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_field_mappings_connection ON field_mappings(connection_id);
    CREATE INDEX IF NOT EXISTS idx_record_map_connection ON record_map(connection_id);
    CREATE INDEX IF NOT EXISTS idx_record_map_airtable ON record_map(connection_id, airtable_record_id);
    CREATE INDEX IF NOT EXISTS idx_record_map_webflow ON record_map(connection_id, webflow_item_id);
    CREATE INDEX IF NOT EXISTS idx_sync_logs_connection ON sync_logs(connection_id);
  `);

  // ─── Migrations ─────────────────────────────────────────────
  // SQLite does not support "ADD COLUMN IF NOT EXISTS", so we attempt the
  // ALTER and silently ignore the error when the column already exists.

  const migrations = [
    'ALTER TABLE field_mappings ADD COLUMN linked_connection_id TEXT',
    'ALTER TABLE connections ADD COLUMN message_field TEXT',
    'ALTER TABLE connections ADD COLUMN sync_time_field TEXT',
    'ALTER TABLE connections ADD COLUMN webflow_id_field TEXT',
    'ALTER TABLE connections ADD COLUMN airtable_id_slug TEXT',
    'ALTER TABLE connections ADD COLUMN last_modified_field TEXT',
  ];

  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // ── Drop NOT NULL + CHECK constraint on connections.direction ──
  // Direction is now passed per-sync-request, not stored on the connection.
  // SQLite can't ALTER COLUMN, so we recreate the table.
  // Guard: only run if the column is still NOT NULL (check via table_info).
  const dirCol = (db.prepare(`PRAGMA table_info(connections)`).all() as { name: string; notnull: number }[])
    .find(c => c.name === 'direction');
  if (dirCol?.notnull) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE connections_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        direction TEXT,
        airtable_base_id TEXT NOT NULL,
        airtable_table_id TEXT NOT NULL,
        airtable_view_id TEXT,
        webflow_site_id TEXT NOT NULL,
        webflow_collection_id TEXT NOT NULL,
        action_field TEXT,
        message_field TEXT,
        sync_time_field TEXT,
        webflow_id_field TEXT,
        airtable_id_slug TEXT,
        last_modified_field TEXT,
        cron_schedule TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO connections_new SELECT
        id, name, direction, airtable_base_id, airtable_table_id,
        airtable_view_id, webflow_site_id, webflow_collection_id,
        action_field, message_field, sync_time_field, webflow_id_field,
        airtable_id_slug, last_modified_field, cron_schedule,
        is_active, last_synced_at, created_at, updated_at
      FROM connections;
      DROP TABLE connections;
      ALTER TABLE connections_new RENAME TO connections;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
