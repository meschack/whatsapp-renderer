import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import {
  createArchiveBootstrap,
  LATEST_ARCHIVE_SCHEMA_VERSION,
  type ArchiveDatabase
} from '../store/archive-bootstrap'

class TestArchiveDatabase implements ArchiveDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async exec(source: string): Promise<void> {
    this.database.exec(source)
  }

  async run(source: string, params: (string | number | null)[] = []): Promise<void> {
    this.database.prepare(source).run(...params)
  }

  async first<T>(source: string, params: (string | number | null)[] = []): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }

  async all<T>(source: string, params: (string | number | null)[] = []): Promise<T[]> {
    return this.database.prepare(source).all(...params) as T[]
  }

  async transaction(task: (database: ArchiveDatabase) => Promise<void>): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      await task(this)
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
}

describe('archive bootstrap', () => {
  it('upgrades an unversioned legacy archive without losing readable chats or messages', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE messages (
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
      CREATE TABLE saved_chats (
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
      INSERT INTO saved_chats VALUES (
        'chat-1', 'Alice', 'Me', '["Me","Alice"]', 'file:///chat-1', 1,
        'Corrected', '2026-08-20T10:45:00.000Z', '2026-08-21T08:00:00.000Z'
      );
      INSERT INTO messages (
        chatId, sender, text, mediaType, mediaUri, timestamp, isMine, isSystem
      ) VALUES (
        'chat-1', 'Alice', 'Corrected <This message was edited>', NULL, NULL,
        1787222700000, 0, 0
      );
    `)
    const database = new TestArchiveDatabase(sqlite)
    const bootstrapArchive = createArchiveBootstrap(async () => database)

    const result = await bootstrapArchive()

    expect(result).toMatchObject({
      status: 'ready',
      savedChats: [{ id: 'chat-1', chatName: 'Alice', participants: ['Me', 'Alice'] }]
    })
    expect(await database.first<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: LATEST_ARCHIVE_SCHEMA_VERSION
    })
    expect(
      (await database.all<{ name: string }>('PRAGMA table_info(messages)')).map(
        column => column.name
      )
    ).toEqual(
      expect.arrayContaining([
        'mediaFilename',
        'mediaSize',
        'mediaWidth',
        'mediaHeight',
        'mediaDuration',
        'mediaPreviewUri'
      ])
    )
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_positions'"
      )
    ).toEqual({ name: 'chat_positions' })
    expect(
      await database.first<{ text: string; isEdited: number }>(
        'SELECT text, isEdited FROM messages WHERE chatId = ?',
        ['chat-1']
      )
    ).toEqual({ text: 'Corrected', isEdited: 1 })
    expect(
      await database.first<{ rowid: number }>(
        "SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'Corrected'"
      )
    ).toEqual({ rowid: 1 })

    await database.run(
      `INSERT INTO messages (chatId, sender, text, timestamp, isEdited, isMine, isSystem)
       VALUES ('chat-1', 'Alice', 'Searchable later', 1787222800000, 0, 0, 0)`
    )
    expect(
      await database.first<{ rowid: number }>(
        "SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'Searchable'"
      )
    ).toEqual({ rowid: 2 })
    await database.run('DELETE FROM messages WHERE id = 2')
    expect(
      await database.first<{ rowid: number }>(
        "SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'Searchable'"
      )
    ).toBeNull()

    const reopened = await createArchiveBootstrap(async () => database)()
    expect(reopened).toMatchObject({
      status: 'ready',
      savedChats: [{ id: 'chat-1' }]
    })
    expect(
      await database.first<{ text: string; isEdited: number }>(
        'SELECT text, isEdited FROM messages WHERE chatId = ?',
        ['chat-1']
      )
    ).toEqual({ text: 'Corrected', isEdited: 1 })

    sqlite.close()
  })

  it('is idempotent and shares one database open across concurrent callers', async () => {
    const sqlite = new DatabaseSync(':memory:')
    const database = new TestArchiveDatabase(sqlite)
    let openCount = 0
    const bootstrapArchive = createArchiveBootstrap(async () => {
      openCount += 1
      return database
    })

    const [first, second] = await Promise.all([bootstrapArchive(), bootstrapArchive()])
    const third = await bootstrapArchive()

    expect(first).toEqual({ status: 'ready', savedChats: [] })
    expect(second).toEqual(first)
    expect(third).toEqual(first)
    expect(openCount).toBe(1)
    expect(await database.first<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: LATEST_ARCHIVE_SCHEMA_VERSION
    })

    sqlite.close()
  })

  it('returns a typed startup error and retries instead of caching the failure', async () => {
    const sqlite = new DatabaseSync(':memory:')
    const database = new TestArchiveDatabase(sqlite)
    let openCount = 0
    const bootstrapArchive = createArchiveBootstrap(async () => {
      openCount += 1
      if (openCount === 1) throw new Error('disk is unavailable')
      return database
    })

    const failed = await bootstrapArchive()
    const recovered = await bootstrapArchive()

    expect(failed).toMatchObject({
      status: 'error',
      error: { name: 'ArchiveBootstrapError', message: 'disk is unavailable' }
    })
    expect(recovered).toEqual({ status: 'ready', savedChats: [] })
    expect(openCount).toBe(2)

    sqlite.close()
  })
})
