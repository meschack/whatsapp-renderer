import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ db: null as unknown, abort: null as AbortController | null }))
vi.mock('../store/archive-database', () => ({ getArchiveDatabase: () => state.db }))
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(readonly uri: string) {}
    get exists() {
      return this.uri.includes('/healthy/')
    }
  }
}))
vi.mock('../utils/zip-extractor', () => ({
  extractZip: async () => 'file:///repair',
  cleanupExtractedChat: vi.fn(),
  cleanupTemporaryArchive: vi.fn()
}))
vi.mock('../utils/file-scanner', () => ({
  discoverChatArchive: async () => ({
    transcriptUri: 'file:///repair/_chat.txt',
    mediaCandidates: [
      { filename: 'missing.jpg', uri: 'file:///repair/missing.jpg', type: 'image', size: 50 },
      { filename: 'healthy.jpg', uri: 'file:///repair/healthy.jpg', type: 'image', size: 50 }
    ]
  })
}))
vi.mock('../utils/archive-fingerprint', () => ({ fingerprintArchive: async () => 'known-export' }))
vi.mock('../utils/chat-update-matcher', () => ({ findChatUpdate: async () => null }))
vi.mock('../store/message-database', () => ({ getRecentMessages: () => [] }))
vi.mock('../utils/transcript-stream', () => ({ openFileTranscript: () => async function* () {} }))
vi.mock('../utils/whatsapp-chat-parser', () => ({
  visitWhatsAppChatStream: async () => ({
    messageCount: 2,
    diagnostics: { counts: { 'ambiguous-dates': 0 } }
  })
}))
vi.mock('../utils/media-index', () => ({
  indexMedia: async () => {
    state.abort?.abort()
    return new Map([
      [
        'missing.jpg',
        {
          filename: 'missing.jpg',
          uri: 'file:///repair/missing.jpg',
          type: 'image',
          size: 50,
          width: 100,
          height: 100,
          duration: null,
          previewUri: 'file:///repair/preview.jpg',
          waveform: null
        }
      ]
    ])
  }
}))
import { repairChatMedia } from '../utils/repair-chat-media'
import { cleanupExtractedChat } from '../utils/zip-extractor'
import type { SavedChat } from '../models/types'
const chat: SavedChat = {
  id: 'chat',
  chatName: 'Alice',
  myName: 'Me',
  participants: ['Me', 'Alice'],
  extractDirUri: 'file:///old',
  messageCount: 2,
  importedAt: '2026-08-01',
  lastMessageTime: '2026-08-01',
  lastMessageText: 'Retain this',
  archiveFingerprint: 'known-export'
}
let db: DatabaseSync
beforeEach(() => {
  state.abort = null
  vi.clearAllMocks()
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY, chatId TEXT, text TEXT, mediaType TEXT, mediaFilename TEXT, mediaUri TEXT, mediaPreviewUri TEXT, mediaWidth INTEGER, mediaHeight INTEGER, mediaSize INTEGER, mediaDuration REAL, mediaWaveform TEXT);
    CREATE TABLE saved_chats (id TEXT PRIMARY KEY, extractDirUri TEXT);
    CREATE TABLE chat_sources (chatId TEXT, directoryUri TEXT, importedAt TEXT, UNIQUE(chatId, directoryUri));
    CREATE TABLE message_bookmarks (messageId INTEGER PRIMARY KEY);
    CREATE TABLE chat_positions (chatId TEXT, messageSequence INTEGER);
    INSERT INTO messages (id,chatId,text,mediaType,mediaFilename,mediaUri) VALUES (1,'chat','Retain this','image','missing.jpg','file:///old/missing.jpg'),(2,'chat','Keep this too','image','healthy.jpg','file:///healthy/healthy.jpg');
    INSERT INTO saved_chats VALUES ('chat','file:///old'); INSERT INTO message_bookmarks VALUES (1); INSERT INTO chat_positions VALUES ('chat',1);`)
  state.db = {
    getAllSync: (sql: string, ...params: (string | number | null)[]) =>
      db.prepare(sql).all(...params),
    runSync: (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).run(...params),
    withTransactionSync: (task: () => void) => {
      db.exec('BEGIN')
      try {
        task()
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    }
  }
})
afterEach(() => db.close())
describe('repair commits without replacing a durable chat', () => {
  it('rebinds missing files while retaining messages, IDs, intact attachments, bookmarks and position', async () => {
    const result = await repairChatMedia(chat, {
      temporaryArchiveUri: 'file:///cache.zip',
      archiveName: 'Export.zip',
      onReview: async preview => {
        expect(preview.newMessageCount).toBe(0)
        return true
      }
    })
    expect(result.chat.id).toBe('chat')
    expect(db.prepare('SELECT text,mediaUri FROM messages WHERE id=1').get()).toMatchObject({
      text: 'Retain this',
      mediaUri: 'file:///repair/missing.jpg'
    })
    expect(db.prepare('SELECT mediaUri FROM messages WHERE id=2').get()).toMatchObject({
      mediaUri: 'file:///healthy/healthy.jpg'
    })
    expect(db.prepare('SELECT * FROM message_bookmarks').all()).toHaveLength(1)
    expect(db.prepare('SELECT messageSequence FROM chat_positions').get()).toMatchObject({
      messageSequence: 1
    })
    expect(cleanupExtractedChat).not.toHaveBeenCalled()
  })
  it('leaves the original archive untouched when review is declined', async () => {
    await expect(
      repairChatMedia(chat, {
        temporaryArchiveUri: 'file:///cache.zip',
        archiveName: 'Export.zip',
        onReview: () => false
      })
    ).rejects.toMatchObject({ name: 'ImportCancelledError' })
    expect(db.prepare('SELECT mediaUri FROM messages WHERE id=1').get()).toMatchObject({
      mediaUri: 'file:///old/missing.jpg'
    })
    expect(cleanupExtractedChat).toHaveBeenCalledWith('file:///repair')
  })
  it('does not commit after cancellation during media preparation', async () => {
    state.abort = new AbortController()
    await expect(
      repairChatMedia(chat, {
        temporaryArchiveUri: 'file:///cache.zip',
        archiveName: 'Export.zip',
        signal: state.abort.signal,
        onReview: () => true
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(db.prepare('SELECT extractDirUri FROM saved_chats').get()).toMatchObject({
      extractDirUri: 'file:///old'
    })
    expect(cleanupExtractedChat).toHaveBeenCalledWith('file:///repair')
  })
})
