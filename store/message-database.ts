import type { MediaAttachment, MediaMap, Message } from '@/models/types'
import type { TimelineRecord } from '@/utils/chat-timeline'
import {
  AUDIO_BAR_COUNT,
  AUDIO_BAR_MAX_HEIGHT,
  AUDIO_BAR_MIN_HEIGHT
} from '../utils/audio-presentation'
import { buildSearchExpression, HIGHLIGHT_END, HIGHLIGHT_START } from '../utils/message-search'
import { extractFirstUrl } from '../utils/message-links'
import type { AttachmentFilter, AttachmentPage, AttachmentRecord } from '../utils/media-library'
import type { BookmarkCursor, BookmarkPage, BookmarkRecord } from '../utils/bookmarks'
import { getLocalDayBounds, type ChatDateTarget, type ChatDay } from '../utils/chat-calendar'
import { getArchiveDatabase } from './archive-database'
import { insertMessageBatchIntoDatabaseAsync } from './message-batch-writer'

/** Insert one bounded import batch without monopolizing the JavaScript thread. */
export async function insertMessageBatchAsync(chatId: string, messages: Message[]): Promise<void> {
  await insertMessageBatchIntoDatabaseAsync(getArchiveDatabase(), chatId, messages)
}

interface MessageRow {
  id: number
  sender: string | null
  text: string | null
  mediaType: string | null
  mediaUri: string | null
  mediaFilename: string | null
  mediaSize: number | null
  mediaWidth: number | null
  mediaHeight: number | null
  mediaDuration: number | null
  mediaPreviewUri: string | null
  mediaWaveform: string | null
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
    mediaFilename: row.mediaFilename,
    mediaSize: row.mediaSize,
    mediaWidth: row.mediaWidth,
    mediaHeight: row.mediaHeight,
    mediaDuration: row.mediaDuration,
    mediaPreviewUri: row.mediaPreviewUri,
    mediaWaveform: parseWaveform(row.mediaWaveform),
    timestamp: new Date(row.timestamp),
    isEdited: row.isEdited === 1,
    isMine: row.isMine === 1,
    isSystem: row.isSystem === 1
  }
}

function parseWaveform(value: string | null): number[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed) || parsed.length !== AUDIO_BAR_COUNT) return null
    if (!parsed.every(sample => typeof sample === 'number' && Number.isFinite(sample))) return null
    return parsed.map(sample =>
      Math.max(AUDIO_BAR_MIN_HEIGHT, Math.min(AUDIO_BAR_MAX_HEIGHT, sample))
    )
  } catch {
    return null
  }
}

function serializeWaveform(
  mediaType: Message['mediaType'],
  waveform: number[] | null
): string | null {
  if (mediaType === 'audio') return JSON.stringify(waveform ?? [])
  return waveform ? JSON.stringify(waveform) : null
}

export interface MessagePage {
  records: TimelineRecord[]
  hasMore: boolean
}

export interface InitialMessagePage {
  records: TimelineRecord[]
  hasOlder: boolean
  hasNewer: boolean
  restoredSequence: number | null
}

export interface MessageSearchResult {
  messageId: string
  sequence: number
  sender: string | null
  timestamp: Date
  excerpt: string
}

export interface MessageSearchPage {
  results: MessageSearchResult[]
  hasMore: boolean
  nextCursor: number | null
}

export async function getChatDays(chatId: string): Promise<ChatDay[]> {
  if (!chatId) return []
  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<{ dayKey: string; messageCount: number }>(
    `SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') AS dayKey,
            COUNT(*) AS messageCount
     FROM messages
     WHERE chatId = ?
     GROUP BY dayKey
     ORDER BY dayKey ASC`,
    chatId
  )

  return rows.filter(row => Boolean(row.dayKey))
}

export async function findFirstMessageOnLocalDay(
  chatId: string,
  dayKey: string
): Promise<ChatDateTarget | null> {
  const bounds = getLocalDayBounds(dayKey)
  if (!chatId || !bounds) return null

  const db = getArchiveDatabase()
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM messages
     WHERE chatId = ? AND timestamp >= ? AND timestamp < ?
     ORDER BY timestamp ASC, id ASC
     LIMIT 1`,
    chatId,
    bounds.start,
    bounds.end
  )

  return row ? { dayKey, sequence: row.id, messageId: `msg-${row.id}` } : null
}

interface AttachmentRow {
  id: number
  sender: string | null
  text: string | null
  mediaType: string | null
  mediaUri: string | null
  mediaFilename: string | null
  mediaSize: number | null
  mediaWidth: number | null
  mediaHeight: number | null
  mediaDuration: number | null
  mediaPreviewUri: string | null
  timestamp: number
}

const ATTACHMENT_COLUMNS = `m.id, m.sender, m.text, m.mediaType, m.mediaUri,
  m.mediaFilename, m.mediaSize, m.mediaWidth, m.mediaHeight, m.mediaDuration,
  m.mediaPreviewUri, m.timestamp`

function rowsToAttachmentPage(
  rows: AttachmentRow[],
  filter: AttachmentFilter,
  limit: number,
  reverse: boolean
): AttachmentPage {
  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  if (reverse) pageRows.reverse()

  return {
    records: pageRows.map(
      (row): AttachmentRecord => ({
        sequence: row.id,
        messageId: `msg-${row.id}`,
        type: filter,
        sender: row.sender,
        timestamp: new Date(row.timestamp),
        text: row.text,
        mediaUri: row.mediaUri,
        previewUri: row.mediaPreviewUri,
        filename: row.mediaFilename,
        size: row.mediaSize,
        width: row.mediaWidth,
        height: row.mediaHeight,
        duration: row.mediaDuration,
        url: filter === 'link' && row.text ? extractFirstUrl(row.text) : null
      })
    ),
    hasMore
  }
}

async function queryAttachmentRows(
  chatId: string,
  filter: AttachmentFilter,
  operator: '<' | '>',
  cursor: number,
  order: 'ASC' | 'DESC',
  limit: number
): Promise<AttachmentRow[]> {
  const db = getArchiveDatabase()
  if (filter === 'link') {
    return db.getAllAsync<AttachmentRow>(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM messages_fts
       JOIN messages AS m ON m.id = messages_fts.rowid
       WHERE messages_fts MATCH '"http"*'
         AND (instr(lower(m.text), 'http://') > 0 OR instr(lower(m.text), 'https://') > 0)
         AND m.chatId = ? AND m.id ${operator} ?
       ORDER BY m.id ${order}
       LIMIT ?`,
      chatId,
      cursor,
      limit + 1
    )
  }

  return db.getAllAsync<AttachmentRow>(
    `SELECT ${ATTACHMENT_COLUMNS}
     FROM messages AS m
     WHERE m.chatId = ? AND m.mediaType = ? AND m.id ${operator} ?
     ORDER BY m.id ${order}
     LIMIT ?`,
    chatId,
    filter,
    cursor,
    limit + 1
  )
}

export async function getOlderAttachmentPage(
  chatId: string,
  filter: AttachmentFilter,
  beforeSequence: number | null,
  limit: number
): Promise<AttachmentPage> {
  const rows = await queryAttachmentRows(
    chatId,
    filter,
    '<',
    beforeSequence ?? Number.MAX_SAFE_INTEGER,
    'DESC',
    limit
  )
  return rowsToAttachmentPage(rows, filter, limit, false)
}

export async function getNewerAttachmentPage(
  chatId: string,
  filter: AttachmentFilter,
  afterSequence: number,
  limit: number
): Promise<AttachmentPage> {
  const rows = await queryAttachmentRows(chatId, filter, '>', afterSequence, 'ASC', limit)
  return rowsToAttachmentPage(rows, filter, limit, true)
}

const MESSAGE_PAGE_COLUMNS = `id, sender, text, mediaType, mediaUri, mediaFilename, mediaSize,
   mediaWidth, mediaHeight, mediaDuration, mediaPreviewUri,
   mediaWaveform, timestamp, isEdited, isMine, isSystem`

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

/**
 * Open directly around the last visible message. This is deliberately one initial
 * repository operation so the UI never renders the newest edge before restoration.
 */
export async function getInitialMessagePage(
  chatId: string,
  limit: number,
  preferredSequence?: number
): Promise<InitialMessagePage> {
  const db = getArchiveDatabase()
  const position =
    preferredSequence === undefined
      ? await db.getFirstAsync<{ messageSequence: number }>(
          'SELECT messageSequence FROM chat_positions WHERE chatId = ?',
          chatId
        )
      : { messageSequence: preferredSequence }

  if (position) {
    const anchor = position.messageSequence
    const [beforeRows, anchorAndAfterRows] = await Promise.all([
      db.getAllAsync<MessageRow>(
        `SELECT ${MESSAGE_PAGE_COLUMNS}
         FROM messages
         WHERE chatId = ? AND id < ?
         ORDER BY id DESC
         LIMIT ?`,
        chatId,
        anchor,
        limit + 1
      ),
      db.getAllAsync<MessageRow>(
        `SELECT ${MESSAGE_PAGE_COLUMNS}
         FROM messages
         WHERE chatId = ? AND id >= ?
         ORDER BY id ASC
         LIMIT ?`,
        chatId,
        anchor,
        limit + 1
      )
    ])

    if (anchorAndAfterRows[0]?.id === anchor) {
      let beforeCount = Math.min(beforeRows.length, Math.floor(limit / 2))
      let afterCount = Math.min(anchorAndAfterRows.length, limit - beforeCount)

      // Fill from the opposite side when the anchor is close to either edge.
      beforeCount = Math.min(beforeRows.length, limit - afterCount)
      afterCount = Math.min(anchorAndAfterRows.length, limit - beforeCount)

      const rows = [
        ...beforeRows.slice(0, beforeCount).reverse(),
        ...anchorAndAfterRows.slice(0, afterCount)
      ]

      return {
        records: rows.map(row => ({ sequence: row.id, message: rowToMessage(row) })),
        hasOlder: beforeRows.length > beforeCount,
        hasNewer: anchorAndAfterRows.length > afterCount,
        restoredSequence: anchor
      }
    }
  }

  const latest = await getLatestMessagePage(chatId, limit)
  return {
    records: latest.records,
    hasOlder: latest.hasMore,
    hasNewer: false,
    restoredSequence: null
  }
}

export async function searchMessages(
  chatId: string,
  query: string,
  limit: number,
  afterSequence = 0
): Promise<MessageSearchPage> {
  const expression = buildSearchExpression(query)
  if (!expression || limit <= 0) return { results: [], hasMore: false, nextCursor: null }

  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<{
    id: number
    sender: string | null
    timestamp: number
    excerpt: string
  }>(
    `SELECT m.id, m.sender, m.timestamp,
            snippet(messages_fts, 0, ?, ?, ' … ', 18) AS excerpt
     FROM messages_fts
     JOIN messages AS m ON m.id = messages_fts.rowid
     WHERE messages_fts MATCH ? AND m.chatId = ? AND m.id > ?
     ORDER BY m.id ASC
     LIMIT ?`,
    HIGHLIGHT_START,
    HIGHLIGHT_END,
    expression,
    chatId,
    Math.max(0, afterSequence),
    limit + 1
  )
  const pageRows = rows.slice(0, limit)

  return {
    results: pageRows.map(row => ({
      messageId: `msg-${row.id}`,
      sequence: row.id,
      sender: row.sender,
      timestamp: new Date(row.timestamp),
      excerpt: row.excerpt
    })),
    hasMore: rows.length > limit,
    nextCursor: pageRows.at(-1)?.id ?? null
  }
}

export async function saveChatPosition(chatId: string, messageSequence: number): Promise<void> {
  if (!chatId || !Number.isSafeInteger(messageSequence) || messageSequence <= 0) return

  const db = getArchiveDatabase()
  await db.runAsync(
    `INSERT INTO chat_positions (chatId, messageSequence, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(chatId) DO UPDATE SET
       messageSequence = excluded.messageSequence,
       updatedAt = excluded.updatedAt`,
    chatId,
    messageSequence,
    Date.now()
  )
}

export async function isMessageBookmarked(messageSequence: number): Promise<boolean> {
  const db = getArchiveDatabase()
  const row = await db.getFirstAsync<{ messageId: number }>(
    'SELECT messageId FROM message_bookmarks WHERE messageId = ?',
    messageSequence
  )
  return row !== null
}

export async function setMessageBookmarked(
  chatId: string,
  messageSequence: number,
  bookmarked: boolean
): Promise<void> {
  const db = getArchiveDatabase()
  if (!bookmarked) {
    await db.runAsync('DELETE FROM message_bookmarks WHERE messageId = ?', messageSequence)
    return
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO message_bookmarks (messageId, chatId, createdAt)
     SELECT id, chatId, ? FROM messages WHERE id = ? AND chatId = ?`,
    Date.now(),
    messageSequence,
    chatId
  )
}

export async function getBookmarkPage(
  chatId: string,
  cursor: BookmarkCursor | null,
  limit: number
): Promise<BookmarkPage> {
  if (limit <= 0) return { records: [], hasMore: false, nextCursor: null }

  const db = getArchiveDatabase()
  const cursorClause = cursor
    ? `AND (
         b.createdAt < ? OR
         (b.createdAt = ? AND b.messageId < ?)
       )`
    : ''
  const cursorParams = cursor ? [cursor.createdAt, cursor.createdAt, cursor.messageSequence] : []
  const rows = await db.getAllAsync<{
    messageId: number
    sender: string | null
    timestamp: number
    excerpt: string | null
    mediaType: string | null
    createdAt: number
  }>(
    `SELECT b.messageId, m.sender, m.timestamp,
            substr(COALESCE(NULLIF(trim(m.text), ''), m.mediaFilename, 'Message'), 1, 240) AS excerpt,
            m.mediaType, b.createdAt
     FROM message_bookmarks AS b
     JOIN messages AS m ON m.id = b.messageId AND m.chatId = b.chatId
     WHERE b.chatId = ? ${cursorClause}
     ORDER BY b.createdAt DESC, b.messageId DESC
     LIMIT ?`,
    chatId,
    ...cursorParams,
    limit + 1
  )
  const pageRows = rows.slice(0, limit)
  const last = pageRows.at(-1)

  return {
    records: pageRows.map(
      (row): BookmarkRecord => ({
        sequence: row.messageId,
        messageId: `msg-${row.messageId}`,
        sender: row.sender,
        timestamp: new Date(row.timestamp),
        excerpt: row.excerpt ?? 'Message',
        mediaType: row.mediaType as BookmarkRecord['mediaType'],
        createdAt: row.createdAt
      })
    ),
    hasMore: rows.length > limit,
    nextCursor: last ? { createdAt: last.createdAt, messageSequence: last.messageId } : null
  }
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
 * Resolve the immediate chronological successor of a voice message.
 * A later voice message is deliberately not returned when any other message sits between them.
 */
export async function getNextConsecutiveAudioUri(
  chatId: string,
  currentUri: string
): Promise<string | null> {
  if (!chatId || !currentUri) return null

  const row = await getArchiveDatabase().getFirstAsync<{
    mediaType: string | null
    mediaUri: string | null
  }>(
    `SELECT mediaType, mediaUri
     FROM messages
     WHERE chatId = ?
       AND id > (
         SELECT id
         FROM messages
         WHERE chatId = ? AND mediaUri = ?
         ORDER BY id DESC
         LIMIT 1
       )
     ORDER BY id ASC
     LIMIT 1`,
    chatId,
    chatId,
    currentUri
  )

  return row?.mediaType === 'audio' && row.mediaUri ? row.mediaUri : null
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

/** Return a small chronological tail used to prove continuity with a later export. */
export function getRecentMessages(chatId: string, limit: number): Message[] {
  if (!Number.isInteger(limit) || limit < 1) return []
  const rows = getArchiveDatabase().getAllSync<MessageRow>(
    `SELECT ${MESSAGE_PAGE_COLUMNS}
     FROM messages
     WHERE chatId = ?
     ORDER BY id DESC
     LIMIT ?`,
    chatId,
    limit
  )
  return rows.reverse().map(rowToMessage)
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
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM message_bookmarks WHERE chatId = ?', chatId)
    db.runSync('DELETE FROM messages WHERE chatId = ?', chatId)
    db.runSync('DELETE FROM chat_positions WHERE chatId = ?', chatId)
  })
}

export async function hasUnindexedMedia(chatId: string): Promise<boolean> {
  const db = getArchiveDatabase()
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM messages
     WHERE chatId = ? AND mediaUri IS NOT NULL
       AND (mediaFilename IS NULL OR (mediaType = 'audio' AND mediaWaveform IS NULL))
     LIMIT 1`,
    chatId
  )
  return row !== null
}

export async function getUnindexedMediaUris(chatId: string): Promise<Set<string>> {
  const db = getArchiveDatabase()
  const rows = await db.getAllAsync<{ mediaUri: string }>(
    `SELECT DISTINCT mediaUri FROM messages
     WHERE chatId = ? AND mediaUri IS NOT NULL
       AND (mediaFilename IS NULL OR (mediaType = 'audio' AND mediaWaveform IS NULL))`,
    chatId
  )
  return new Set(rows.map(row => row.mediaUri))
}

/** Persist one inspection immediately so interrupted legacy indexing can resume. */
export async function applyMediaAttachmentIndex(
  chatId: string,
  attachment: MediaAttachment
): Promise<void> {
  const db = getArchiveDatabase()
  await db.runAsync(
    `UPDATE messages SET
       mediaType = ?, mediaFilename = ?, mediaSize = ?, mediaWidth = ?,
       mediaHeight = ?, mediaDuration = ?, mediaPreviewUri = ?, mediaWaveform = ?
     WHERE chatId = ? AND mediaUri = ?`,
    attachment.type,
    attachment.filename,
    attachment.size,
    attachment.width,
    attachment.height,
    attachment.duration,
    attachment.previewUri,
    serializeWaveform(attachment.type, attachment.waveform),
    chatId,
    attachment.uri
  )
}

/** Lazily attach metadata to rows imported before media indexing existed. */
export async function applyMediaIndex(chatId: string, mediaMap: MediaMap): Promise<void> {
  const db = getArchiveDatabase()
  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `UPDATE messages SET
         mediaType = ?, mediaFilename = ?, mediaSize = ?, mediaWidth = ?,
         mediaHeight = ?, mediaDuration = ?, mediaPreviewUri = ?, mediaWaveform = ?
       WHERE chatId = ? AND mediaUri = ?`
    )
    try {
      for (const attachment of mediaMap.values()) {
        await statement.executeAsync(
          attachment.type,
          attachment.filename,
          attachment.size,
          attachment.width,
          attachment.height,
          attachment.duration,
          attachment.previewUri,
          serializeWaveform(attachment.type, attachment.waveform),
          chatId,
          attachment.uri
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  })
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
