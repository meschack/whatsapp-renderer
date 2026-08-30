import type { SavedChat } from '../models/types'
import type { ChatUpdateMatch } from '../utils/chat-update-matcher'
import { parseImportDiagnostics } from '../utils/import-diagnostics'
import { getArchiveDatabase } from './archive-database'
import { whatsAppExportMarkers } from '../utils/whatsapp-export-markers'

interface SavedChatDatabaseRow extends Omit<
  SavedChat,
  'participants' | 'importDiagnostics' | 'isPinned' | 'isArchived'
> {
  participants: string
  importDiagnostics: string | null
  isPinned: number
  isArchived: number
}

interface PersistedMessageRow {
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

function deserializeSavedChat(row: SavedChatDatabaseRow): SavedChat {
  return {
    ...row,
    lastMessageText: whatsAppExportMarkers.normalizeStoredPreview(row.lastMessageText),
    participants: JSON.parse(row.participants) as string[],
    importDiagnostics: parseImportDiagnostics(row.importDiagnostics),
    isPinned: row.isPinned === 1,
    isArchived: row.isArchived === 1
  }
}

export const getAllSavedChats = (): SavedChat[] => {
  const db = getArchiveDatabase()
  const rows = db.getAllSync<SavedChatDatabaseRow>(
    'SELECT * FROM saved_chats ORDER BY lastMessageTime DESC'
  )

  return rows.map(deserializeSavedChat)
}

export const renameSavedChat = (id: string, chatName: string): void => {
  getArchiveDatabase().runSync('UPDATE saved_chats SET chatName = ? WHERE id = ?', chatName, id)
}

export const setSavedChatPinned = (id: string, pinned: boolean, now = Date.now()): void => {
  getArchiveDatabase().runSync(
    'UPDATE saved_chats SET isPinned = ?, pinnedAt = ? WHERE id = ?',
    pinned ? 1 : 0,
    pinned ? now : null,
    id
  )
}

export const setSavedChatArchived = (id: string, archived: boolean): void => {
  getArchiveDatabase().runSync(
    'UPDATE saved_chats SET isArchived = ? WHERE id = ?',
    archived ? 1 : 0,
    id
  )
}

export const saveChatMetadata = (chat: SavedChat): void => {
  const db = getArchiveDatabase()
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO saved_chats
        (id, chatName, myName, participants, extractDirUri, messageCount, lastMessageText, lastMessageTime, importedAt, archiveFingerprint, importDiagnostics)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          chatName = excluded.chatName,
          myName = excluded.myName,
          participants = excluded.participants,
          extractDirUri = excluded.extractDirUri,
          messageCount = excluded.messageCount,
          lastMessageText = excluded.lastMessageText,
          lastMessageTime = excluded.lastMessageTime,
          importedAt = excluded.importedAt,
          archiveFingerprint = excluded.archiveFingerprint,
          importDiagnostics = excluded.importDiagnostics`,
      chat.id,
      chat.chatName,
      chat.myName,
      JSON.stringify(chat.participants),
      chat.extractDirUri,
      chat.messageCount,
      chat.lastMessageText,
      chat.lastMessageTime,
      chat.importedAt,
      chat.archiveFingerprint ?? null,
      chat.importDiagnostics ? JSON.stringify(chat.importDiagnostics) : null
    )
    db.runSync(
      `INSERT OR IGNORE INTO chat_sources (chatId, directoryUri, importedAt)
       VALUES (?, ?, ?)`,
      chat.id,
      chat.extractDirUri,
      chat.importedAt
    )
  })
}

export const getChatSourceDirectories = (chatId: string): string[] => {
  const rows = getArchiveDatabase().getAllSync<{ directoryUri: string }>(
    `SELECT directoryUri FROM chat_sources
     WHERE chatId = ?
     ORDER BY importedAt ASC, directoryUri ASC`,
    chatId
  )
  return rows.map(row => row.directoryUri)
}

export const deleteSavedChat = (id: string): void => {
  const db = getArchiveDatabase()
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM chat_positions WHERE chatId = ?', id)
    db.runSync('DELETE FROM saved_chats WHERE id = ?', id)
  })
}

export const deleteAllSavedChats = (): void => {
  const db = getArchiveDatabase()
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM chat_positions')
    db.runSync('DELETE FROM saved_chats')
  })
}

export const getSavedChat = (id: string): SavedChat | null => {
  const db = getArchiveDatabase()
  const row = db.getFirstSync<SavedChatDatabaseRow>('SELECT * FROM saved_chats WHERE id = ?', id)

  if (!row) return null

  return deserializeSavedChat(row)
}

export const getSavedChatByFingerprint = (fingerprint: string): SavedChat | null => {
  const db = getArchiveDatabase()
  const row = db.getFirstSync<SavedChatDatabaseRow>(
    'SELECT * FROM saved_chats WHERE archiveFingerprint = ? LIMIT 1',
    fingerprint
  )
  return row ? deserializeSavedChat(row) : null
}

/** Merge a parsed update stage while preserving the existing chat's user-owned identity and state. */
export function mergeSavedChatUpdate(
  existing: SavedChat,
  staged: SavedChat,
  match: ChatUpdateMatch
): SavedChat {
  const db = getArchiveDatabase()
  let messageCount = existing.messageCount

  db.withTransactionSync(() => {
    if (match.mode === 'reconcile-latest') {
      const existingLatest = db.getFirstSync<{ id: number }>(
        'SELECT id FROM messages WHERE chatId = ? ORDER BY id DESC LIMIT 1',
        existing.id
      )
      const correctedLatest = db.getFirstSync<PersistedMessageRow>(
        'SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC LIMIT 1',
        staged.id
      )
      if (!existingLatest || !correctedLatest) {
        throw new Error('The staged update does not contain the message that must be reconciled.')
      }

      db.runSync(
        `UPDATE messages SET
           sender = ?, text = ?, mediaType = ?, mediaUri = ?, mediaFilename = ?,
           mediaSize = ?, mediaWidth = ?, mediaHeight = ?, mediaDuration = ?,
           mediaPreviewUri = ?, mediaWaveform = ?, timestamp = ?, isEdited = ?,
           isMine = ?, isSystem = ?
         WHERE id = ? AND chatId = ?`,
        correctedLatest.sender,
        correctedLatest.text,
        correctedLatest.mediaType,
        correctedLatest.mediaUri,
        correctedLatest.mediaFilename,
        correctedLatest.mediaSize,
        correctedLatest.mediaWidth,
        correctedLatest.mediaHeight,
        correctedLatest.mediaDuration,
        correctedLatest.mediaPreviewUri,
        correctedLatest.mediaWaveform,
        correctedLatest.timestamp,
        correctedLatest.isEdited,
        correctedLatest.isMine,
        correctedLatest.isSystem,
        existingLatest.id,
        existing.id
      )
      db.runSync('DELETE FROM messages WHERE id = ?', correctedLatest.id)
    }

    db.runSync('UPDATE messages SET chatId = ? WHERE chatId = ?', existing.id, staged.id)
    messageCount =
      db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM messages WHERE chatId = ?',
        existing.id
      )?.count ?? existing.messageCount
    const lastMessage = db.getFirstSync<{ text: string | null; timestamp: number }>(
      `SELECT text, timestamp FROM messages
       WHERE chatId = ? AND isSystem = 0
       ORDER BY id DESC LIMIT 1`,
      existing.id
    )

    db.runSync(
      `INSERT OR IGNORE INTO chat_sources (chatId, directoryUri, importedAt)
       VALUES (?, ?, ?)`,
      existing.id,
      existing.extractDirUri,
      existing.importedAt
    )
    db.runSync(
      `INSERT OR IGNORE INTO chat_sources (chatId, directoryUri, importedAt)
       VALUES (?, ?, ?)`,
      existing.id,
      staged.extractDirUri,
      staged.importedAt
    )
    db.runSync(
      `UPDATE saved_chats SET
         participants = ?, extractDirUri = ?, messageCount = ?, lastMessageText = ?,
         lastMessageTime = ?, importedAt = ?, archiveFingerprint = ?, importDiagnostics = ?
       WHERE id = ?`,
      JSON.stringify(staged.participants),
      staged.extractDirUri,
      messageCount,
      lastMessage?.text ?? null,
      lastMessage ? new Date(lastMessage.timestamp).toISOString() : existing.lastMessageTime,
      staged.importedAt,
      staged.archiveFingerprint ?? null,
      staged.importDiagnostics ? JSON.stringify(staged.importDiagnostics) : null,
      existing.id
    )
  })

  const lastMessage = db.getFirstSync<{ text: string | null; timestamp: number }>(
    `SELECT text, timestamp FROM messages
     WHERE chatId = ? AND isSystem = 0
     ORDER BY id DESC LIMIT 1`,
    existing.id
  )

  return {
    ...existing,
    participants: staged.participants,
    extractDirUri: staged.extractDirUri,
    messageCount,
    lastMessageText: lastMessage?.text ?? null,
    lastMessageTime: lastMessage
      ? new Date(lastMessage.timestamp).toISOString()
      : existing.lastMessageTime,
    importedAt: staged.importedAt,
    archiveFingerprint: staged.archiveFingerprint,
    importDiagnostics: staged.importDiagnostics
  }
}
