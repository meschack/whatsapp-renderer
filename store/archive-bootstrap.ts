import type { SavedChat } from '../models/types'
import { parseImportDiagnostics } from '../utils/import-diagnostics'
import { stripEditedMarker } from '../utils/message-text'

export type ArchiveBindValue = string | number | null

export interface ArchiveDatabase {
  exec(source: string): Promise<void>
  run(source: string, params?: ArchiveBindValue[]): Promise<void>
  first<T>(source: string, params?: ArchiveBindValue[]): Promise<T | null>
  all<T>(source: string, params?: ArchiveBindValue[]): Promise<T[]>
  transaction(task: (database: ArchiveDatabase) => Promise<void>): Promise<void>
  close?(): Promise<void>
}

export type ArchiveBootstrapResult =
  | { status: 'ready'; savedChats: SavedChat[] }
  | { status: 'error'; error: ArchiveBootstrapError }

export class ArchiveBootstrapError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Unable to open the local chat archive', {
      cause
    })
    this.name = 'ArchiveBootstrapError'
  }
}

interface SavedChatRow {
  id: string
  chatName: string
  myName: string
  participants: string
  extractDirUri: string
  messageCount: number
  lastMessageText: string | null
  lastMessageTime: string
  importedAt: string
  archiveFingerprint: string | null
  importDiagnostics: string | null
}

interface Migration {
  version: number
  migrate(database: ArchiveDatabase): Promise<void>
}

export const LATEST_ARCHIVE_SCHEMA_VERSION = 10

const migrations: Migration[] = [
  {
    version: 1,
    async migrate(database) {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatId TEXT NOT NULL,
          sender TEXT,
          text TEXT,
          mediaType TEXT,
          mediaUri TEXT,
          timestamp INTEGER NOT NULL,
          isMine INTEGER NOT NULL DEFAULT 0,
          isSystem INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS saved_chats (
          id TEXT PRIMARY KEY,
          chatName TEXT NOT NULL,
          myName TEXT NOT NULL,
          participants TEXT NOT NULL,
          extractDirUri TEXT NOT NULL,
          messageCount INTEGER NOT NULL,
          lastMessageText TEXT,
          lastMessageTime TEXT NOT NULL,
          importedAt TEXT NOT NULL
        );
      `)
    }
  },
  {
    version: 2,
    async migrate(database) {
      const columns = await database.all<{ name: string }>('PRAGMA table_info(messages)')
      if (!columns.some(column => column.name === 'isEdited')) {
        await database.exec('ALTER TABLE messages ADD COLUMN isEdited INTEGER NOT NULL DEFAULT 0')
      }

      const editedRows = await database.all<{ id: number; text: string }>(
        `SELECT id, text FROM messages
         WHERE text LIKE '%<This message was edited>%'
            OR text LIKE '%<Ce message a été modifié>%'`
      )

      for (const row of editedRows) {
        const { cleanText } = stripEditedMarker(row.text)
        await database.run('UPDATE messages SET text = ?, isEdited = 1 WHERE id = ?', [
          cleanText,
          row.id
        ])
      }

      await database.exec(`
        DELETE FROM messages
        WHERE mediaType = 'image'
          AND mediaUri IS NULL
          AND text IS NULL;
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, id);
      `)
    }
  },
  {
    version: 3,
    async migrate(database) {
      const columns = await database.all<{ name: string }>('PRAGMA table_info(messages)')
      const additions = [
        ['mediaFilename', 'TEXT'],
        ['mediaSize', 'INTEGER'],
        ['mediaWidth', 'INTEGER'],
        ['mediaHeight', 'INTEGER'],
        ['mediaDuration', 'REAL'],
        ['mediaPreviewUri', 'TEXT']
      ] as const

      for (const [name, type] of additions) {
        if (!columns.some(column => column.name === name)) {
          await database.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`)
        }
      }

      await database.exec(
        'CREATE INDEX IF NOT EXISTS idx_messages_media ON messages(chatId, mediaType, id)'
      )
    }
  },
  {
    version: 4,
    async migrate(database) {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS chat_positions (
          chatId TEXT PRIMARY KEY,
          messageSequence INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 5,
    async migrate(database) {
      await database.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          text,
          content='messages',
          content_rowid='id',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
        END;
        CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, text)
          VALUES ('delete', old.id, old.text);
        END;
        CREATE TRIGGER IF NOT EXISTS messages_fts_update
        AFTER UPDATE OF text ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, text)
          VALUES ('delete', old.id, old.text);
          INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
        END;
        INSERT INTO messages_fts(messages_fts) VALUES ('rebuild');
      `)
    }
  },
  {
    version: 6,
    async migrate(database) {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS message_bookmarks (
          messageId INTEGER PRIMARY KEY,
          chatId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(messageId) REFERENCES messages(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_message_bookmarks_chat
          ON message_bookmarks(chatId, createdAt DESC);
      `)
    }
  },
  {
    version: 7,
    async migrate(database) {
      const columns = await database.all<{ name: string }>('PRAGMA table_info(saved_chats)')
      if (!columns.some(column => column.name === 'archiveFingerprint')) {
        await database.exec('ALTER TABLE saved_chats ADD COLUMN archiveFingerprint TEXT')
      }
      await database.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_chats_fingerprint
          ON saved_chats(archiveFingerprint)
          WHERE archiveFingerprint IS NOT NULL;
      `)
    }
  },
  {
    version: 8,
    async migrate(database) {
      const columns = await database.all<{ name: string }>('PRAGMA table_info(saved_chats)')
      if (!columns.some(column => column.name === 'importDiagnostics')) {
        await database.exec('ALTER TABLE saved_chats ADD COLUMN importDiagnostics TEXT')
      }
    }
  },
  {
    version: 9,
    async migrate(database) {
      await database.exec(
        'CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp ON messages(chatId, timestamp)'
      )
    }
  },
  {
    version: 10,
    async migrate(database) {
      const columns = await database.all<{ name: string }>('PRAGMA table_info(messages)')
      if (!columns.some(column => column.name === 'mediaWaveform')) {
        await database.exec('ALTER TABLE messages ADD COLUMN mediaWaveform TEXT')
      }
    }
  }
]

export function createArchiveBootstrap(
  openDatabase: () => Promise<ArchiveDatabase>,
  onReady?: (database: ArchiveDatabase) => void
): () => Promise<ArchiveBootstrapResult> {
  let readyResult: ArchiveBootstrapResult | null = null
  let inFlight: Promise<ArchiveBootstrapResult> | null = null

  return async function bootstrapArchive() {
    if (readyResult?.status === 'ready') return readyResult
    if (inFlight) return inFlight

    inFlight = performBootstrap(openDatabase, onReady)
    const result = await inFlight
    inFlight = null
    if (result.status === 'ready') readyResult = result
    return result
  }
}

async function performBootstrap(
  openDatabase: () => Promise<ArchiveDatabase>,
  onReady?: (database: ArchiveDatabase) => void
): Promise<ArchiveBootstrapResult> {
  let database: ArchiveDatabase | null = null

  try {
    database = await openDatabase()
    await database.exec(
      'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;'
    )
    await migrateArchive(database)
    const savedChats = await loadSavedChats(database)
    onReady?.(database)
    return { status: 'ready', savedChats }
  } catch (cause) {
    await database?.close?.().catch(() => undefined)
    return { status: 'error', error: new ArchiveBootstrapError(cause) }
  }
}

async function migrateArchive(database: ArchiveDatabase): Promise<void> {
  const row = await database.first<{ user_version: number }>('PRAGMA user_version')
  let currentVersion = row?.user_version ?? 0

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue

    await database.transaction(async transaction => {
      await migration.migrate(transaction)
      await transaction.exec(`PRAGMA user_version = ${migration.version}`)
    })
    currentVersion = migration.version
  }
}

async function loadSavedChats(database: ArchiveDatabase): Promise<SavedChat[]> {
  const rows = await database.all<SavedChatRow>(
    'SELECT * FROM saved_chats ORDER BY lastMessageTime DESC'
  )

  return rows.map(row => ({
    ...row,
    participants: JSON.parse(row.participants) as string[],
    importDiagnostics: parseImportDiagnostics(row.importDiagnostics)
  }))
}
