import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const databaseState = vi.hoisted(() => ({ database: null as TestMessageDatabase | null }))

vi.mock('../store/archive-database', () => ({
  getArchiveDatabase: () => databaseState.database
}))

import { getInitialMessagePage, saveChatPosition } from '../store/message-database'
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
