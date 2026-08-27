import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const databaseState = vi.hoisted(() => ({ database: null as TestMessageDatabase | null }))

vi.mock('../store/archive-database', () => ({
  getArchiveDatabase: () => databaseState.database
}))

import { getNextConsecutiveAudioUri } from '../store/message-database'

class TestMessageDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }
}

describe('consecutive audio autoplay', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId TEXT NOT NULL,
        mediaType TEXT,
        mediaUri TEXT
      );
      CREATE INDEX idx_messages_chat ON messages(chatId, id);
    `)
    databaseState.database = new TestMessageDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('walks a consecutive run of audio messages until the run ends', async () => {
    insertMessage('chat-1', 'audio', 'file:///voice-1.opus')
    insertMessage('chat-1', 'audio', 'file:///voice-2.opus')
    insertMessage('chat-1', 'audio', 'file:///voice-3.opus')
    insertMessage('chat-1', null, null)

    await expect(getNextConsecutiveAudioUri('chat-1', 'file:///voice-1.opus')).resolves.toBe(
      'file:///voice-2.opus'
    )
    await expect(getNextConsecutiveAudioUri('chat-1', 'file:///voice-2.opus')).resolves.toBe(
      'file:///voice-3.opus'
    )
    await expect(getNextConsecutiveAudioUri('chat-1', 'file:///voice-3.opus')).resolves.toBeNull()
  })

  it('stops at the first non-audio message instead of skipping over it', async () => {
    insertMessage('chat-1', 'audio', 'file:///voice-1.opus')
    insertMessage('chat-1', null, null)
    insertMessage('chat-1', 'audio', 'file:///voice-2.opus')

    await expect(getNextConsecutiveAudioUri('chat-1', 'file:///voice-1.opus')).resolves.toBeNull()
  })

  it('never crosses into another chat or returns an audio without a local file', async () => {
    insertMessage('chat-1', 'audio', 'file:///voice-1.opus')
    insertMessage('chat-1', 'audio', null)
    insertMessage('chat-2', 'audio', 'file:///other-chat.opus')

    await expect(getNextConsecutiveAudioUri('chat-1', 'file:///voice-1.opus')).resolves.toBeNull()
  })

  function insertMessage(chatId: string, mediaType: string | null, mediaUri: string | null): void {
    sqlite
      .prepare('INSERT INTO messages (chatId, mediaType, mediaUri) VALUES (?, ?, ?)')
      .run(chatId, mediaType, mediaUri)
  }
})
