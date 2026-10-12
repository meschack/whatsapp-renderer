import {
  DEFAULT_CHAT_APPEARANCE,
  normalizeChatAppearance,
  type ChatAppearancePreference
} from '@/utils/chat-appearance'
import { getArchiveDatabase } from './archive-database'

export function getChatAppearance(chatId: string): ChatAppearancePreference {
  if (!chatId) return { ...DEFAULT_CHAT_APPEARANCE, textScaleOverride: null }
  const row = getArchiveDatabase().getFirstSync<{
    wallpaper: string
    textScale: number
    textScaleOverride: number | null
    customWallpaperUri: string | null
    wallpaperDimming: number
  }>(
    `SELECT wallpaper, textScale, customWallpaperUri, wallpaperDimming, textScaleOverride
     FROM chat_appearance WHERE chatId = ?`,
    chatId
  )
  const normalized = normalizeChatAppearance(
    row?.wallpaper,
    row?.textScale,
    row?.customWallpaperUri,
    row?.wallpaperDimming
  )
  return {
    ...normalized,
    textScaleOverride:
      row?.textScaleOverride == null
        ? null
        : normalizeChatAppearance(null, row.textScaleOverride).textScale
  }
}

export function saveChatAppearance(chatId: string, preference: ChatAppearancePreference): void {
  if (!chatId) return
  const normalized = normalizeChatAppearance(
    preference.wallpaper,
    preference.textScale,
    preference.customWallpaperUri,
    preference.wallpaperDimming
  )
  getArchiveDatabase().runSync(
    `INSERT INTO chat_appearance (
       chatId, wallpaper, textScale, customWallpaperUri, wallpaperDimming, textScaleOverride
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(chatId) DO UPDATE SET
       wallpaper = excluded.wallpaper,
       textScale = excluded.textScale,
       customWallpaperUri = excluded.customWallpaperUri,
       wallpaperDimming = excluded.wallpaperDimming,
       textScaleOverride = excluded.textScaleOverride`,
    chatId,
    normalized.wallpaper,
    normalized.textScale,
    normalized.customWallpaperUri,
    normalized.wallpaperDimming,
    preference.textScaleOverride === undefined ? normalized.textScale : preference.textScaleOverride
  )
}

export function resetChatAppearance(chatId: string): void {
  if (!chatId) return
  getArchiveDatabase().runSync('DELETE FROM chat_appearance WHERE chatId = ?', chatId)
}
