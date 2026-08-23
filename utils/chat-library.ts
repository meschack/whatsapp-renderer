import type { SavedChat } from '@/models/types'

export type ChatNameValidation = { ok: true; value: string } | { ok: false; error: string }

export function normalizeChatName(value: string): ChatNameValidation {
  const normalized = value.trim().replace(/\s+/gu, ' ')
  if (!normalized) return { ok: false, error: 'Enter a chat name.' }
  if (normalized.length > 80) {
    return { ok: false, error: 'Chat names must be 80 characters or fewer.' }
  }
  return { ok: true, value: normalized }
}

function compareChats(left: SavedChat, right: SavedChat): number {
  const leftPinned = left.isPinned ? 1 : 0
  const rightPinned = right.isPinned ? 1 : 0
  if (leftPinned !== rightPinned) return rightPinned - leftPinned

  if (leftPinned) {
    const pinnedDifference = (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0)
    if (pinnedDifference !== 0) return pinnedDifference
  }

  const activityDifference =
    new Date(right.lastMessageTime).getTime() - new Date(left.lastMessageTime).getTime()
  if (activityDifference !== 0) return activityDifference
  return left.id.localeCompare(right.id)
}

export function getChatLibrarySections(chats: SavedChat[]): {
  active: SavedChat[]
  archived: SavedChat[]
} {
  const active: SavedChat[] = []
  const archived: SavedChat[] = []
  for (const chat of chats) (chat.isArchived ? archived : active).push(chat)
  active.sort(compareChats)
  archived.sort(compareChats)
  return { active, archived }
}
