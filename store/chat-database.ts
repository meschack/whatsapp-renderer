import type { SavedChat } from '@/models/types'
import { getArchiveDatabase } from './archive-database'

export const getAllSavedChats = (): SavedChat[] => {
  const db = getArchiveDatabase()
  const rows = db.getAllSync<{
    id: string
    chatName: string
    myName: string
    participants: string
    extractDirUri: string
    messageCount: number
    lastMessageText: string | null
    lastMessageTime: string
    importedAt: string
    archiveFingerprint: string | null
  }>('SELECT * FROM saved_chats ORDER BY lastMessageTime DESC')

  return rows.map(row => ({
    ...row,
    participants: JSON.parse(row.participants) as string[]
  }))
}

export const saveChatMetadata = (chat: SavedChat): void => {
  const db = getArchiveDatabase()
  db.runSync(
    `INSERT INTO saved_chats
      (id, chatName, myName, participants, extractDirUri, messageCount, lastMessageText, lastMessageTime, importedAt, archiveFingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        chatName = excluded.chatName,
        myName = excluded.myName,
        participants = excluded.participants,
        extractDirUri = excluded.extractDirUri,
        messageCount = excluded.messageCount,
        lastMessageText = excluded.lastMessageText,
        lastMessageTime = excluded.lastMessageTime,
        importedAt = excluded.importedAt,
        archiveFingerprint = excluded.archiveFingerprint`,
    chat.id,
    chat.chatName,
    chat.myName,
    JSON.stringify(chat.participants),
    chat.extractDirUri,
    chat.messageCount,
    chat.lastMessageText,
    chat.lastMessageTime,
    chat.importedAt,
    chat.archiveFingerprint ?? null
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
  const row = db.getFirstSync<{
    id: string
    chatName: string
    myName: string
    participants: string
    extractDirUri: string
    messageCount: number
    lastMessageText: string | null
    lastMessageTime: string
    importedAt: string
    archiveFingerprint: string | null
  }>('SELECT * FROM saved_chats WHERE id = ?', id)

  if (!row) return null

  return {
    ...row,
    participants: JSON.parse(row.participants) as string[]
  }
}

export const getSavedChatByFingerprint = (fingerprint: string): SavedChat | null => {
  const db = getArchiveDatabase()
  const row = db.getFirstSync<{
    id: string
    chatName: string
    myName: string
    participants: string
    extractDirUri: string
    messageCount: number
    lastMessageText: string | null
    lastMessageTime: string
    importedAt: string
    archiveFingerprint: string | null
  }>('SELECT * FROM saved_chats WHERE archiveFingerprint = ? LIMIT 1', fingerprint)
  return row ? { ...row, participants: JSON.parse(row.participants) as string[] } : null
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
         lastMessageTime, importedAt, archiveFingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      replacement.id,
      replacement.chatName,
      replacement.myName,
      JSON.stringify(replacement.participants),
      replacement.extractDirUri,
      replacement.messageCount,
      replacement.lastMessageText,
      replacement.lastMessageTime,
      replacement.importedAt,
      replacement.archiveFingerprint ?? null
    )
  })
}
