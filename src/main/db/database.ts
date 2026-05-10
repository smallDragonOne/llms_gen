import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'llms-generator.db')
}

export function initDatabase(): void {
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function runMigrations(): void {
  const database = getDatabase()

  database.exec(`
    CREATE TABLE IF NOT EXISTS crawl_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      config TEXT NOT NULL DEFAULT '{}',
      total_pages INTEGER DEFAULT 0,
      fetched_pages INTEGER DEFAULT 0,
      filtered_pages INTEGER DEFAULT 0,
      kept_pages INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES crawl_tasks(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      url_normalized TEXT NOT NULL,
      url_hash TEXT NOT NULL,
      title TEXT,
      description TEXT,
      content TEXT,
      text_content TEXT,
      content_hash TEXT,
      category TEXT DEFAULT 'unknown',
      category_source TEXT DEFAULT 'rule',
      importance INTEGER DEFAULT 0,
      importance_source TEXT DEFAULT 'rule',
      keep INTEGER DEFAULT 1,
      ai_reason TEXT,
      status TEXT DEFAULT 'pending',
      filter_reason TEXT,
      has_code_block INTEGER DEFAULT 0,
      heading_count INTEGER DEFAULT 0,
      content_length INTEGER DEFAULT 0,
      fetch_time INTEGER,
      depth INTEGER DEFAULT 0,
      lang TEXT,
      site_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(task_id, url_hash)
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES crawl_tasks(id) ON DELETE CASCADE,
      from_url TEXT NOT NULL,
      to_url TEXT NOT NULL,
      anchor_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      category TEXT,
      confidence INTEGER DEFAULT 0,
      importance INTEGER DEFAULT 0,
      keep INTEGER DEFAULT 1,
      reason TEXT,
      model TEXT,
      tokens_used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pages_task ON pages(task_id);
    CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
    CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category);
    CREATE INDEX IF NOT EXISTS idx_pages_importance ON pages(importance DESC);
    CREATE INDEX IF NOT EXISTS idx_pages_url_hash ON pages(url_hash);
    CREATE INDEX IF NOT EXISTS idx_pages_content_hash ON pages(content_hash);
    CREATE INDEX IF NOT EXISTS idx_links_task ON links(task_id);
    CREATE INDEX IF NOT EXISTS idx_ai_page ON ai_analysis(page_id);
  `)

  // Migration: change UNIQUE(url_hash) to UNIQUE(task_id, url_hash)
  migrateV2(database)
}

function migrateV2(database: Database.Database): void {
  try {
    // Clean up any leftover from a failed migration
    const tableInfo = database.pragma('table_list')
    const hasPagesNew = tableInfo.some((t: any) => t.name === 'pages_new')
    if (hasPagesNew) {
      database.exec('DROP TABLE IF EXISTS pages_new')
    }

    const indexInfo = database.pragma('index_list(pages)')

    // Check if the unique constraint is already (task_id, url_hash)
    // by looking at index columns
    let needsMigration = false
    for (const idx of indexInfo) {
      if (idx.unique !== 1) continue
      const cols = database.pragma(`index_info(${idx.name})`) as Array<{ name: string }>
      const colNames = cols.map(c => c.name)
      if (colNames.length === 1 && colNames[0] === 'url_hash') {
        needsMigration = true
        break
      }
    }

    if (needsMigration) {
      database.exec(`
        CREATE TABLE pages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES crawl_tasks(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          url_normalized TEXT NOT NULL,
          url_hash TEXT NOT NULL,
          title TEXT,
          description TEXT,
          content TEXT,
          text_content TEXT,
          content_hash TEXT,
          category TEXT DEFAULT 'unknown',
          category_source TEXT DEFAULT 'rule',
          importance INTEGER DEFAULT 0,
          importance_source TEXT DEFAULT 'rule',
          keep INTEGER DEFAULT 1,
          ai_reason TEXT,
          status TEXT DEFAULT 'pending',
          filter_reason TEXT,
          has_code_block INTEGER DEFAULT 0,
          heading_count INTEGER DEFAULT 0,
          content_length INTEGER DEFAULT 0,
          fetch_time INTEGER,
          depth INTEGER DEFAULT 0,
          lang TEXT,
          site_name TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(task_id, url_hash)
        );
        INSERT INTO pages_new SELECT * FROM pages;
        DROP TABLE pages;
        ALTER TABLE pages_new RENAME TO pages;
      `)
      // Recreate indexes
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_pages_task ON pages(task_id);
        CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
        CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category);
        CREATE INDEX IF NOT EXISTS idx_pages_importance ON pages(importance DESC);
        CREATE INDEX IF NOT EXISTS idx_pages_url_hash ON pages(url_hash);
        CREATE INDEX IF NOT EXISTS idx_pages_content_hash ON pages(content_hash);
      `)
    }
  } catch (err) {
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
