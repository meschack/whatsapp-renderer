import type { Message } from '@/models/types'
import type { TimelineRecord } from '@/utils/chat-timeline'
import { getArchiveDatabase } from './archive-database'

/**
 * Batch insert messages into SQLite within a transaction.
 * Each message gets its chatId set. Insertion order = chronological order
 * so autoincrement id preserves message ordering.
 */
export function insertMessageBatch(chatId: string, messages: Message[]): void {
  const db = getArchiveDatabase()
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

export interface MessagePage {
  records: TimelineRecord[]
  hasMore: boolean
}

const MESSAGE_PAGE_COLUMNS =
  'id, sender, text, mediaType, mediaUri, timestamp, isEdited, isMine, isSystem'

function rowsToPage(rows: MessageRow[], limit: number, newestFirst: boolean): MessagePage {
  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  if (newestFirst) pageRows.reverse()

  return {
    records: pageRows.map(row => ({ sequence: row.id, message: rowToMessage(row) })),
    hasMore
  }
}

/** Load the newest messages without blocking the JavaScript thread. */
export async function getLatestMessagePage(chatId: string, limit: number): Promise<MessagePage> {
  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT ${MESSAGE_PAGE_COLUMNS}
     FROM messages
     WHERE chatId = ?
     ORDER BY id DESC
     LIMIT ?`,
    chatId,
    limit + 1
  )

  return rowsToPage(rows, limit, true)
}

/** Load history using a stable keyset cursor instead of an increasingly expensive OFFSET. */
export async function getOlderMessagePage(
  chatId: string,
  beforeSequence: number,
  limit: number
): Promise<MessagePage> {
  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT ${MESSAGE_PAGE_COLUMNS}
     FROM messages
     WHERE chatId = ? AND id < ?
     ORDER BY id DESC
     LIMIT ?`,
    chatId,
    beforeSequence,
    limit + 1
  )

  return rowsToPage(rows, limit, true)
}

/** Reload the newer edge after the bounded window has discarded it. */
export async function getNewerMessagePage(
  chatId: string,
  afterSequence: number,
  limit: number
): Promise<MessagePage> {
  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT ${MESSAGE_PAGE_COLUMNS}
     FROM messages
     WHERE chatId = ? AND id > ?
     ORDER BY id ASC
     LIMIT ?`,
    chatId,
    afterSequence,
    limit + 1
  )

  return rowsToPage(rows, limit, false)
}

/**
 * Get total message count for a chat.
 */
export function getMessageCount(chatId: string): number {
  const db = getArchiveDatabase()
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
  const db = getArchiveDatabase()
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
  const db = getArchiveDatabase()
  db.withTransactionSync(() => {
    db.runSync('UPDATE messages SET isMine = 0 WHERE chatId = ?', chatId)
    db.runSync('UPDATE messages SET isMine = 1 WHERE chatId = ? AND sender = ?', chatId, senderName)
  })
}

/**
 * Delete all messages for a chat.
 */
export function deleteMessages(chatId: string): void {
  const db = getArchiveDatabase()
  db.runSync('DELETE FROM messages WHERE chatId = ?', chatId)
}

/**
 * Get distinct participants for a chat.
 */
export function getParticipants(chatId: string): string[] {
  const db = getArchiveDatabase()
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
  const db = getArchiveDatabase()
  const row = db.getFirstSync<{ text: string | null; timestamp: number }>(
    'SELECT text, timestamp FROM messages WHERE chatId = ? AND isSystem = 0 ORDER BY id DESC LIMIT 1',
    chatId
  )
  return row
}
