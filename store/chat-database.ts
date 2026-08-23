import type { SavedChat } from '@/models/types'
import { parseImportDiagnostics } from '@/utils/import-diagnostics'
import { getArchiveDatabase } from './archive-database'

interface SavedChatDatabaseRow extends Omit<
  SavedChat,
  'participants' | 'importDiagnostics' | 'isPinned' | 'isArchived'
> {
  participants: string
  importDiagnostics: string | null
  isPinned: number
  isArchived: number
}

function deserializeSavedChat(row: SavedChatDatabaseRow): SavedChat {
  return {
    ...row,
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

/** Atomically swaps archive-owned database state after replacement parsing has succeeded. */
export const replaceSavedChat = (existingChatId: string, replacement: SavedChat): void => {
  const db = getArchiveDatabase()
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM message_bookmarks WHERE chatId = ?', existingChatId)
    db.runSync('DELETE FROM chat_positions WHERE chatId = ?', existingChatId)
    db.runSync('DELETE FROM messages WHERE chatId = ?', existingChatId)
    db.runSync('DELETE FROM saved_chats WHERE id = ?', existingChatId)
    db.runSync(
      `INSERT INTO saved_chats
        (id, chatName, myName, participants, extractDirUri, messageCount, lastMessageText,
         lastMessageTime, importedAt, archiveFingerprint, importDiagnostics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      replacement.id,
      replacement.chatName,
      replacement.myName,
      JSON.stringify(replacement.participants),
      replacement.extractDirUri,
      replacement.messageCount,
      replacement.lastMessageText,
      replacement.lastMessageTime,
      replacement.importedAt,
      replacement.archiveFingerprint ?? null,
      replacement.importDiagnostics ? JSON.stringify(replacement.importDiagnostics) : null
    )
  })
}
