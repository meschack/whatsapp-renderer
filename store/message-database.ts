import { openDatabaseSync } from 'expo-sqlite'
import type { Message } from '@/models/types'
import { stripEditedMarker } from '@/utils/message-text'

const db = openDatabaseSync('whatsapp-renderer.db')

db.execSync(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId TEXT NOT NULL,
    sender TEXT,
    text TEXT,
    mediaType TEXT,
    mediaUri TEXT,
    timestamp INTEGER NOT NULL,
    isEdited INTEGER NOT NULL DEFAULT 0,
    isMine INTEGER NOT NULL DEFAULT 0,
    isSystem INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, id);
`)

// Legacy cleanup: remove placeholder rows for missing images that should not render as messages.
db.runSync(
  `DELETE FROM messages
   WHERE mediaType = 'image'
     AND mediaUri IS NULL
     AND text IS NULL`
)

const messageColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(messages)')

if (!messageColumns.some(column => column.name === 'isEdited')) {
  db.runSync('ALTER TABLE messages ADD COLUMN isEdited INTEGER NOT NULL DEFAULT 0')

  const legacyEditedRows = db.getAllSync<{ id: number; text: string | null }>(
    'SELECT id, text FROM messages WHERE text LIKE ?',
    '%<This message was edited>%'
  )

  if (legacyEditedRows.length > 0) {
    db.withTransactionSync(() => {
      const stmt = db.prepareSync('UPDATE messages SET text = ?, isEdited = 1 WHERE id = ?')

      try {
        for (const row of legacyEditedRows) {
          const { cleanText } = stripEditedMarker(row.text ?? '')
          stmt.executeSync(cleanText, row.id)
        }
      } finally {
        stmt.finalizeSync()
      }
    })
  }
}

/**
 * Batch insert messages into SQLite within a transaction.
 * Each message gets its chatId set. Insertion order = chronological order
 * so autoincrement id preserves message ordering.
 */
export function insertMessageBatch(chatId: string, messages: Message[]): void {
  db.withTransactionSync(() => {
    const stmt = db.prepareSync(
      `INSERT INTO messages (chatId, sender, text, mediaType, mediaUri, timestamp, isEdited, isMine, isSystem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    try {
      for (const msg of messages) {
        stmt.executeSync(
          chatId,
          msg.sender,
          msg.text,
          msg.mediaType,
          msg.mediaUri,
          msg.timestamp.getTime(),
          msg.isEdited ? 1 : 0,
          msg.isMine ? 1 : 0,
          msg.isSystem ? 1 : 0
        )
      }
    } finally {
      stmt.finalizeSync()
    }
  })
}

interface MessageRow {
  id: number
  sender: string | null
  text: string | null
  mediaType: string | null
  mediaUri: string | null
  timestamp: number
  isEdited: number
  isMine: number
  isSystem: number
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: `msg-${row.id}`,
    sender: row.sender,
    text: row.text,
    mediaType: row.mediaType as Message['mediaType'],
    mediaUri: row.mediaUri,
    timestamp: new Date(row.timestamp),
    isEdited: row.isEdited === 1,
    isMine: row.isMine === 1,
    isSystem: row.isSystem === 1
  }
}

/**
 * Get a page of messages for a chat, ordered newest-first (for inverted list).
 */
export function getMessagePage(chatId: string, limit: number, offset: number): Message[] {
  const rows = db.getAllSync<MessageRow>(
    'SELECT * FROM messages WHERE chatId = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    chatId,
    limit,
    offset
  )
  return rows.map(rowToMessage)
}

/**
 * Get total message count for a chat.
 */
export function getMessageCount(chatId: string): number {
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM messages WHERE chatId = ?',
    chatId
  )
  return row?.count ?? 0
}

/**
 * Check if messages exist for a chat (for legacy migration detection).
 */
export function hasMessages(chatId: string): boolean {
  const row = db.getFirstSync<{ id: number }>(
    'SELECT id FROM messages WHERE chatId = ? LIMIT 1',
    chatId
  )
  return row !== null
}

/**
 * Update isMine flag for all messages from a given sender.
 * Resets all messages to isMine=0 first, then sets isMine=1 for the sender.
 */
export function updateIsMine(chatId: string, senderName: string): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE messages SET isMine = 0 WHERE chatId = ?', chatId)
    db.runSync(
      'UPDATE messages SET isMine = 1 WHERE chatId = ? AND sender = ?',
      chatId,
      senderName
    )
  })
}

/**
 * Delete all messages for a chat.
 */
export function deleteMessages(chatId: string): void {
  db.runSync('DELETE FROM messages WHERE chatId = ?', chatId)
}

/**
 * Get distinct participants for a chat.
 */
export function getParticipants(chatId: string): string[] {
  const rows = db.getAllSync<{ sender: string }>(
    'SELECT DISTINCT sender FROM messages WHERE chatId = ? AND sender IS NOT NULL',
    chatId
  )
  return rows.map(r => r.sender)
}

/**
 * Get the last message text and timestamp for a chat.
 */
export function getLastMessage(chatId: string): { text: string | null; timestamp: number } | null {
  const row = db.getFirstSync<{ text: string | null; timestamp: number }>(
    'SELECT text, timestamp FROM messages WHERE chatId = ? AND isSystem = 0 ORDER BY id DESC LIMIT 1',
    chatId
  )
  return row
}
