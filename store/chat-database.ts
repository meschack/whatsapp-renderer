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
  }>('SELECT * FROM saved_chats ORDER BY lastMessageTime DESC')

  return rows.map(row => ({
    ...row,
    participants: JSON.parse(row.participants) as string[]
  }))
}

export const saveChatMetadata = (chat: SavedChat): void => {
  const db = getArchiveDatabase()
  db.runSync(
    `INSERT OR REPLACE INTO saved_chats
      (id, chatName, myName, participants, extractDirUri, messageCount, lastMessageText, lastMessageTime, importedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    chat.id,
    chat.chatName,
    chat.myName,
    JSON.stringify(chat.participants),
    chat.extractDirUri,
    chat.messageCount,
    chat.lastMessageText,
    chat.lastMessageTime,
    chat.importedAt
  )
}

export const deleteSavedChat = (id: string): void => {
  const db = getArchiveDatabase()
  db.runSync('DELETE FROM saved_chats WHERE id = ?', id)
}

export const deleteAllSavedChats = (): void => {
  const db = getArchiveDatabase()
  db.runSync('DELETE FROM saved_chats')
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
  }>('SELECT * FROM saved_chats WHERE id = ?', id)

  if (!row) return null

  return {
    ...row,
    participants: JSON.parse(row.participants) as string[]
  }
}
