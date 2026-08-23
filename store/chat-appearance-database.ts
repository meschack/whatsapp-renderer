import {
  DEFAULT_CHAT_APPEARANCE,
  normalizeChatAppearance,
  type ChatAppearancePreference
} from '@/utils/chat-appearance'
import { getArchiveDatabase } from './archive-database'

export function getChatAppearance(chatId: string): ChatAppearancePreference {
  if (!chatId) return DEFAULT_CHAT_APPEARANCE
  const row = getArchiveDatabase().getFirstSync<{ wallpaper: string; textScale: number }>(
    'SELECT wallpaper, textScale FROM chat_appearance WHERE chatId = ?',
    chatId
  )
  return normalizeChatAppearance(row?.wallpaper, row?.textScale)
}

export function saveChatAppearance(chatId: string, preference: ChatAppearancePreference): void {
  if (!chatId) return
  const normalized = normalizeChatAppearance(preference.wallpaper, preference.textScale)
  getArchiveDatabase().runSync(
    `INSERT INTO chat_appearance (chatId, wallpaper, textScale) VALUES (?, ?, ?)
     ON CONFLICT(chatId) DO UPDATE SET
       wallpaper = excluded.wallpaper,
       textScale = excluded.textScale`,
    chatId,
    normalized.wallpaper,
    normalized.textScale
  )
}

export function resetChatAppearance(chatId: string): void {
  if (!chatId) return
  getArchiveDatabase().runSync('DELETE FROM chat_appearance WHERE chatId = ?', chatId)
}
