import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const databaseState = vi.hoisted(() => ({ database: null as TestMessageDatabase | null }))

vi.mock('../store/archive-database', () => ({
  getArchiveDatabase: () => databaseState.database
}))

import {
  getInitialMessagePage,
  getBookmarkPage,
  getNewerAttachmentPage,
  getOlderAttachmentPage,
  isMessageBookmarked,
  saveChatPosition,
  setMessageBookmarked,
  searchMessages
} from '../store/message-database'
import { mergeAttachmentWindow } from '../utils/media-library'
import { buildSearchExpression, parseHighlightedExcerpt } from '../utils/message-search'
import { createThrottledWriter } from '../utils/throttled-writer'

class TestMessageDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }

  async getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]> {
    return this.database.prepare(source).all(...params) as T[]
  }

  async runAsync(source: string, ...params: (string | number | null)[]): Promise<void> {
    this.database.prepare(source).run(...params)
  }
}

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT NOT NULL,
      sender TEXT,
      text TEXT,
      mediaType TEXT,
      mediaUri TEXT,
      mediaFilename TEXT,
      mediaSize INTEGER,
      mediaWidth INTEGER,
      mediaHeight INTEGER,
      mediaDuration REAL,
      mediaPreviewUri TEXT,
      timestamp INTEGER NOT NULL,
      isEdited INTEGER NOT NULL DEFAULT 0,
      isMine INTEGER NOT NULL DEFAULT 0,
      isSystem INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE chat_positions (
      chatId TEXT PRIMARY KEY,
      messageSequence INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE message_bookmarks (
      messageId INTEGER PRIMARY KEY,
      chatId TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      text,
      content='messages',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
    END;
    CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, text)
      VALUES ('delete', old.id, old.text);
    END;
    CREATE TRIGGER messages_fts_update AFTER UPDATE OF text ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, text)
      VALUES ('delete', old.id, old.text);
      INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
    END;
  `)
  const insert = database.prepare(
    `INSERT INTO messages (chatId, sender, text, timestamp)
     VALUES ('chat-1', 'Alice', ?, ?)`
  )
  for (let sequence = 1; sequence <= 12; sequence += 1) {
    insert.run(`message ${sequence}`, sequence * 1_000)
  }
  return database
}

describe('chat position restoration', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = createDatabase()
    databaseState.database = new TestMessageDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('opens a bounded bidirectional window around the saved message', async () => {
    await saveChatPosition('chat-1', 6)

    const page = await getInitialMessagePage('chat-1', 5)

    expect(page.records.map(record => record.sequence)).toEqual([4, 5, 6, 7, 8])
    expect(page).toMatchObject({
      restoredSequence: 6,
      hasOlder: true,
      hasNewer: true
    })
  })

  it('restores safely near either trimmed edge', async () => {
    await saveChatPosition('chat-1', 2)
    const nearStart = await getInitialMessagePage('chat-1', 5)

    await saveChatPosition('chat-1', 11)
    const nearEnd = await getInitialMessagePage('chat-1', 5)

    expect(nearStart.records.map(record => record.sequence)).toEqual([1, 2, 3, 4, 5])
    expect(nearStart).toMatchObject({ hasOlder: false, hasNewer: true })
    expect(nearEnd.records.map(record => record.sequence)).toEqual([8, 9, 10, 11, 12])
    expect(nearEnd).toMatchObject({ hasOlder: true, hasNewer: false })
  })

  it('falls back to the newest page when the saved message is unavailable', async () => {
    await saveChatPosition('chat-1', 99)

    const page = await getInitialMessagePage('chat-1', 5)

    expect(page.records.map(record => record.sequence)).toEqual([8, 9, 10, 11, 12])
    expect(page).toMatchObject({ restoredSequence: null, hasOlder: true, hasNewer: false })
  })

  it('lets an explicit navigation target override the persisted position', async () => {
    await saveChatPosition('chat-1', 11)

    const page = await getInitialMessagePage('chat-1', 5, 4)

    expect(page.records.map(record => record.sequence)).toEqual([2, 3, 4, 5, 6])
    expect(page.restoredSequence).toBe(4)
  })

  it('adds and removes bookmarks only for messages in the requested chat', async () => {
    await setMessageBookmarked('chat-1', 4, true)
    await setMessageBookmarked('wrong-chat', 5, true)

    expect(await isMessageBookmarked(4)).toBe(true)
    expect(await isMessageBookmarked(5)).toBe(false)

    await setMessageBookmarked('chat-1', 4, false)
    expect(await isMessageBookmarked(4)).toBe(false)
  })
})

describe('throttled position writer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
  })

  afterEach(() => vi.useRealTimers())

  it('writes the leading value and only the latest value within each interval', () => {
    const write = vi.fn()
    const writer = createThrottledWriter(write, 750)

    writer.schedule(10)
    writer.schedule(11)
    writer.schedule(12)

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenLastCalledWith(10)

    vi.advanceTimersByTime(750)

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith(12)
  })

  it('flushes the last visible message when the screen closes', () => {
    const write = vi.fn()
    const writer = createThrottledWriter(write, 750)

    writer.schedule(20)
    writer.schedule(21)
    writer.flush()

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith(21)
    vi.runAllTimers()
    expect(write).toHaveBeenCalledTimes(2)
  })
})

describe('media library pages', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = createDatabase()
    sqlite.exec(`
      UPDATE messages SET mediaType = 'image', mediaUri = NULL,
        mediaFilename = 'missing.jpg', mediaSize = 120 WHERE id = 2;
      UPDATE messages SET mediaType = 'image', mediaUri = 'file:///4.jpg',
        mediaFilename = '4.jpg', mediaSize = 400 WHERE id = 4;
      UPDATE messages SET mediaType = 'document', mediaUri = 'file:///5.pdf',
        mediaFilename = 'notes.pdf', mediaSize = 500 WHERE id = 5;
      UPDATE messages SET mediaType = 'image', mediaUri = 'file:///6.jpg',
        mediaFilename = '6.jpg', mediaSize = 600 WHERE id = 6;
      UPDATE messages SET mediaType = 'image', mediaUri = 'file:///8.jpg',
        mediaFilename = '8.jpg', mediaSize = 800 WHERE id = 8;
      UPDATE messages SET text = 'See https://example.com/three' WHERE id = 3;
      UPDATE messages SET text = 'See https://example.com/nine' WHERE id = 9;
    `)
    databaseState.database = new TestMessageDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('uses stable keysets in both directions and preserves missing-file identity', async () => {
    const newest = await getOlderAttachmentPage('chat-1', 'image', null, 2)
    const older = await getOlderAttachmentPage(
      'chat-1',
      'image',
      newest.records.at(-1)!.sequence,
      2
    )
    const newer = await getNewerAttachmentPage('chat-1', 'image', 2, 2)

    expect(newest.records.map(record => record.sequence)).toEqual([8, 6])
    expect(newest.hasMore).toBe(true)
    expect(older.records.map(record => record.sequence)).toEqual([4, 2])
    expect(older.records[1]).toMatchObject({
      filename: 'missing.jpg',
      mediaUri: null,
      size: 120
    })
    expect(newer.records.map(record => record.sequence)).toEqual([6, 4])
    expect(newer.hasMore).toBe(true)
  })

  it('filters documents and indexed links without scanning messages in JavaScript', async () => {
    const documents = await getOlderAttachmentPage('chat-1', 'document', null, 10)
    const links = await getOlderAttachmentPage('chat-1', 'link', null, 10)

    expect(documents.records.map(record => record.filename)).toEqual(['notes.pdf'])
    expect(links.records.map(record => [record.sequence, record.url])).toEqual([
      [9, 'https://example.com/nine'],
      [3, 'https://example.com/three']
    ])
  })

  it('caps the retained window and marks the discarded edge as reloadable', async () => {
    const records = (await getOlderAttachmentPage('chat-1', 'image', null, 10)).records
    const older = mergeAttachmentWindow(records.slice(0, 2), records.slice(2), 'older', 3)
    const newer = mergeAttachmentWindow(older.records, [records[0]], 'newer', 3)

    expect(older.records.map(record => record.sequence)).toEqual([6, 4, 2])
    expect(older.trimmedNewer).toBe(true)
    expect(newer.records.map(record => record.sequence)).toEqual([8, 6, 4])
    expect(newer.trimmedOlder).toBe(true)
  })
})

describe('bookmark pages', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = createDatabase()
    sqlite.exec(`
      INSERT INTO message_bookmarks VALUES (2, 'chat-1', 1000);
      INSERT INTO message_bookmarks VALUES (4, 'chat-1', 2000);
      INSERT INTO message_bookmarks VALUES (6, 'chat-1', 3000);
      INSERT INTO message_bookmarks VALUES (8, 'chat-1', 3000);
    `)
    databaseState.database = new TestMessageDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('returns stable paginated bookmark summaries with source identity', async () => {
    const first = await getBookmarkPage('chat-1', null, 2)
    const second = await getBookmarkPage('chat-1', first.nextCursor, 2)

    expect(first.records.map(record => record.sequence)).toEqual([8, 6])
    expect(first.records[0]).toMatchObject({
      messageId: 'msg-8',
      sender: 'Alice',
      timestamp: new Date(8_000),
      excerpt: 'message 8'
    })
    expect(first.hasMore).toBe(true)
    expect(second.records.map(record => record.sequence)).toEqual([4, 2])
    expect(second.hasMore).toBe(false)
  })
})

describe('message search', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = createDatabase()
    sqlite.exec(`
      UPDATE messages SET text = 'Release checklist alpha' WHERE id = 4;
      UPDATE messages SET text = 'Release checklist beta' WHERE id = 7;
      UPDATE messages SET text = 'Release checklist gamma' WHERE id = 10;
      INSERT INTO messages (chatId, sender, text, timestamp)
      VALUES ('chat-2', 'Mallory', 'Release checklist from another chat', 13000);
    `)
    databaseState.database = new TestMessageDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('returns a bounded page with stable identity and highlighted excerpts', async () => {
    const first = await searchMessages('chat-1', 'release check', 2, 0)
    const second = await searchMessages('chat-1', 'release check', 2, first.nextCursor ?? 0)

    expect(first.results).toHaveLength(2)
    expect(first.hasMore).toBe(true)
    expect(first.results[0]).toMatchObject({
      messageId: 'msg-4',
      sequence: 4,
      sender: 'Alice',
      timestamp: new Date(4_000)
    })
    expect(first.results[0].excerpt).toContain('\u0001Release\u0002')
    expect(second.results.map(result => result.sequence)).toEqual([10])
    expect(second.hasMore).toBe(false)
  })

  it('splits SQLite highlight markers into renderable segments', () => {
    expect(parseHighlightedExcerpt('before \u0001needle\u0002 after')).toEqual([
      { text: 'before ', highlighted: false },
      { text: 'needle', highlighted: true },
      { text: ' after', highlighted: false }
    ])
  })

  it('keeps the index correct when searchable text changes or disappears', async () => {
    expect((await searchMessages('chat-1', 'message 4', 10)).results).toEqual([])

    sqlite.exec('DELETE FROM messages WHERE id = 7')
    const afterDelete = await searchMessages('chat-1', 'release check', 10)

    expect(afterDelete.results.map(result => result.sequence)).toEqual([4, 10])
  })

  it('turns punctuation and FTS operators into safe literal prefix terms', () => {
    expect(buildSearchExpression('release OR "check-list"')).toBe(
      '"release"* AND "OR"* AND "check"* AND "list"*'
    )
  })
})
