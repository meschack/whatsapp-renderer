import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const databaseState = vi.hoisted(() => ({ database: null as TestChatDatabase | null }))

vi.mock('../store/archive-database', () => ({
  getArchiveDatabase: () => databaseState.database
}))

import {
  getChatSourceDirectories,
  mergeSavedChatUpdate,
  saveChatMetadata
} from '../store/chat-database'
import type { SavedChat } from '../models/types'
import type { ChatUpdateMatch } from '../utils/chat-update-matcher'

class TestChatDatabase {
  constructor(private readonly database: DatabaseSync) {}

  getFirstSync<T>(source: string, ...params: (string | number | null)[]): T | null {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }

  getAllSync<T>(source: string, ...params: (string | number | null)[]): T[] {
    return this.database.prepare(source).all(...params) as T[]
  }

  runSync(source: string, ...params: (string | number | null)[]): void {
    this.database.prepare(source).run(...params)
  }

  withTransactionSync(task: () => void): void {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      task()
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
}

const existing: SavedChat = {
  id: 'chat-existing',
  chatName: 'My custom name',
  myName: 'Me',
  participants: ['Me', 'Alice'],
  extractDirUri: 'file:///old-source',
  messageCount: 6,
  lastMessageText: 'old latest',
  lastMessageTime: '2026-08-20T08:05:00.000Z',
  importedAt: '2026-08-20T09:00:00.000Z',
  archiveFingerprint: 'old-fingerprint',
  isPinned: true,
  isArchived: false,
  pinnedAt: 123
}

const staged: SavedChat = {
  id: 'chat-stage',
  chatName: 'Alice',
  myName: 'Me',
  participants: ['Me', 'Alice'],
  extractDirUri: 'file:///new-source',
  messageCount: 2,
  lastMessageText: 'new message',
  lastMessageTime: '2026-08-20T08:06:00.000Z',
  importedAt: '2026-08-21T09:00:00.000Z',
  archiveFingerprint: 'new-fingerprint'
}

describe('chat update database merge', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE saved_chats (
        id TEXT PRIMARY KEY, chatName TEXT NOT NULL, myName TEXT NOT NULL,
        participants TEXT NOT NULL, extractDirUri TEXT NOT NULL,
        messageCount INTEGER NOT NULL, lastMessageText TEXT,
        lastMessageTime TEXT NOT NULL, importedAt TEXT NOT NULL,
        archiveFingerprint TEXT, importDiagnostics TEXT,
        isPinned INTEGER NOT NULL DEFAULT 0, isArchived INTEGER NOT NULL DEFAULT 0,
        pinnedAt INTEGER
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, chatId TEXT NOT NULL, sender TEXT, text TEXT,
        mediaType TEXT, mediaUri TEXT, mediaFilename TEXT, mediaSize INTEGER,
        mediaWidth INTEGER, mediaHeight INTEGER, mediaDuration REAL, mediaPreviewUri TEXT,
        mediaWaveform TEXT, timestamp INTEGER NOT NULL, isEdited INTEGER NOT NULL DEFAULT 0,
        isMine INTEGER NOT NULL DEFAULT 0, isSystem INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE message_bookmarks (
        messageId INTEGER PRIMARY KEY, chatId TEXT NOT NULL, createdAt INTEGER NOT NULL
      );
      CREATE TABLE chat_sources (
        chatId TEXT NOT NULL, directoryUri TEXT NOT NULL, importedAt TEXT NOT NULL,
        PRIMARY KEY(chatId, directoryUri)
      );
      INSERT INTO saved_chats VALUES (
        'chat-existing', 'My custom name', 'Me', '["Me","Alice"]', 'file:///old-source',
        6, 'old latest', '2026-08-20T08:05:00.000Z', '2026-08-20T09:00:00.000Z',
        'old-fingerprint', NULL, 1, 0, 123
      );
      INSERT INTO chat_sources VALUES (
        'chat-existing', 'file:///old-source', '2026-08-20T09:00:00.000Z'
      );
    `)
    const insert = sqlite.prepare(
      `INSERT INTO messages (chatId, sender, text, timestamp, isEdited, isMine, isSystem)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
    for (let index = 0; index < 6; index++) {
      insert.run(
        'chat-existing',
        index % 2 ? 'Alice' : 'Me',
        `old-${index}`,
        index,
        0,
        index % 2 ? 0 : 1
      )
    }
    sqlite.exec(`
      INSERT INTO message_bookmarks VALUES (6, 'chat-existing', 100);
      INSERT INTO messages (chatId, sender, text, timestamp, isEdited, isMine, isSystem)
      VALUES ('chat-stage', 'Alice', 'corrected latest', 5, 1, 0, 0),
             ('chat-stage', 'Me', 'new message', 6, 0, 1, 0);
    `)
    databaseState.database = new TestChatDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
  })

  it('reconciles in place, appends staged messages, and preserves user-owned state', () => {
    const match: ChatUpdateMatch = {
      chat: existing,
      mode: 'reconcile-latest',
      skipMessageCount: 5,
      newMessageCount: 1,
      mediaFilenames: []
    }

    const merged = mergeSavedChatUpdate(existing, staged, match)

    expect(merged).toMatchObject({
      id: 'chat-existing',
      chatName: 'My custom name',
      myName: 'Me',
      messageCount: 7,
      lastMessageText: 'new message',
      archiveFingerprint: 'new-fingerprint',
      isPinned: true,
      pinnedAt: 123
    })
    expect(sqlite.prepare('SELECT text, isEdited FROM messages WHERE id = 6').get()).toEqual({
      text: 'corrected latest',
      isEdited: 1
    })
    expect(
      sqlite.prepare('SELECT chatId FROM message_bookmarks WHERE messageId = 6').get()
    ).toEqual({
      chatId: 'chat-existing'
    })
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM messages WHERE chatId = ?').get('chat-existing')
    ).toEqual({ count: 7 })
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM messages WHERE chatId = ?').get('chat-stage')
    ).toEqual({ count: 0 })
    expect(
      sqlite.prepare('SELECT directoryUri FROM chat_sources ORDER BY directoryUri').all()
    ).toEqual([{ directoryUri: 'file:///new-source' }, { directoryUri: 'file:///old-source' }])
  })

  it('registers the source directory of a newly imported chat', () => {
    sqlite.exec('DELETE FROM chat_sources; DELETE FROM saved_chats;')

    saveChatMetadata(staged)

    expect(getChatSourceDirectories(staged.id)).toEqual(['file:///new-source'])
  })

  it('appends a normal update without rewriting the existing tail', () => {
    sqlite.exec("DELETE FROM messages WHERE chatId = 'chat-stage' AND text = 'corrected latest'")
    const match: ChatUpdateMatch = {
      chat: existing,
      mode: 'append',
      skipMessageCount: 6,
      newMessageCount: 1,
      mediaFilenames: []
    }

    const merged = mergeSavedChatUpdate(existing, { ...staged, messageCount: 1 }, match)

    expect(merged.messageCount).toBe(7)
    expect(sqlite.prepare('SELECT text FROM messages WHERE id = 6').get()).toEqual({
      text: 'old-5'
    })
    expect(
      sqlite
        .prepare('SELECT text FROM messages WHERE chatId = ? ORDER BY id DESC LIMIT 1')
        .get('chat-existing')
    ).toEqual({ text: 'new message' })
  })
})
