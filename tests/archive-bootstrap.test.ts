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
        'mediaPreviewUri',
        'mediaWaveform'
      ])
    )
    expect(
      (await database.all<{ name: string }>('PRAGMA table_info(saved_chats)')).map(
        column => column.name
      )
    ).toEqual(
      expect.arrayContaining([
        'archiveFingerprint',
        'importDiagnostics',
        'isPinned',
        'isArchived',
        'pinnedAt'
      ])
    )
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_positions'"
      )
    ).toEqual({ name: 'chat_positions' })
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'message_bookmarks'"
      )
    ).toEqual({ name: 'message_bookmarks' })
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_messages_chat_timestamp'"
      )
    ).toEqual({ name: 'idx_messages_chat_timestamp' })
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'link_previews'"
      )
    ).toEqual({ name: 'link_previews' })
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_preferences'"
      )
    ).toEqual({ name: 'app_preferences' })
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_appearance'"
      )
    ).toEqual({ name: 'chat_appearance' })
    expect(
      (await database.all<{ name: string }>('PRAGMA table_info(chat_appearance)')).map(
        column => column.name
      )
    ).toEqual(expect.arrayContaining(['customWallpaperUri', 'wallpaperDimming']))
    expect(
      await database.first<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_sources'"
      )
    ).toEqual({ name: 'chat_sources' })
    expect(
      await database.first<{ directoryUri: string }>(
        'SELECT directoryUri FROM chat_sources WHERE chatId = ?',
        ['chat-1']
      )
    ).toEqual({ directoryUri: 'file:///chat-1' })
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

    await database.run(
      "INSERT INTO message_bookmarks (messageId, chatId, createdAt) VALUES (1, 'chat-1', 1)"
    )
    await database.run('DELETE FROM messages WHERE id = 1')
    expect(
      await database.first<{ messageId: number }>(
        'SELECT messageId FROM message_bookmarks WHERE messageId = 1'
      )
    ).toBeNull()

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

  it('normalizes exported media markers already stored on the device', async () => {
    const sqlite = new DatabaseSync(':memory:')
    const database = new TestArchiveDatabase(sqlite)
    await createArchiveBootstrap(async () => database)()
    await database.run(
      `INSERT INTO saved_chats (
        id, chatName, myName, participants, extractDirUri, messageCount,
        lastMessageText, lastMessageTime, importedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'chat-1',
        'Alice',
        'Me',
        '["Me","Alice"]',
        'file:///chat-1',
        2,
        '<Médias omis>\nTu penses que ton visage est comme ça',
        '2026-08-20T10:45:00.000Z',
        '2026-08-21T08:00:00.000Z'
      ]
    )
    await database.run(
      `INSERT INTO messages (
        chatId, sender, text, mediaType, mediaUri, timestamp, isMine, isSystem, isEdited
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'chat-1',
        'Alice',
        '(fichier joint)\nRegarde cette photo',
        'image',
        'file:///chat-1/photo.jpg',
        1787222700000,
        0,
        0,
        0
      ]
    )
    await database.run(
      `INSERT INTO messages (
        chatId, sender, text, mediaType, mediaUri, timestamp, isMine, isSystem, isEdited
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'chat-1',
        'Alice',
        '<Médias omis>\nTu penses que ton visage est comme ça',
        null,
        null,
        1787222800000,
        0,
        0,
        0
      ]
    )
    await database.exec('PRAGMA user_version = 16')

    await createArchiveBootstrap(async () => database)()

    expect(
      await database.all<{ text: string; mediaType: string | null }>(
        'SELECT text, mediaType FROM messages WHERE chatId = ? ORDER BY id',
        ['chat-1']
      )
    ).toEqual([
      { text: 'Regarde cette photo', mediaType: 'image' },
      { text: 'Tu penses que ton visage est comme ça', mediaType: 'image' }
    ])
    expect(
      await database.first<{ lastMessageText: string }>(
        'SELECT lastMessageText FROM saved_chats WHERE id = ?',
        ['chat-1']
      )
    ).toEqual({ lastMessageText: 'Tu penses que ton visage est comme ça' })

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
