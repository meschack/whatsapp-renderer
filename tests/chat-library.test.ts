import { describe, expect, it } from 'vitest'
import type { SavedChat } from '../models/types'
import { getChatLibrarySections, normalizeChatName } from '../utils/chat-library'

function chat(id: string, overrides: Partial<SavedChat> = {}): SavedChat {
  return {
    id,
    chatName: id,
    myName: 'Me',
    participants: ['Me', id],
    extractDirUri: `file:///${id}`,
    messageCount: 1,
    lastMessageText: 'Hello',
    lastMessageTime: '2026-08-23T10:00:00.000Z',
    importedAt: '2026-08-23T10:00:00.000Z',
    ...overrides
  }
}

describe('chat library organization', () => {
  it('trims valid names and rejects blank or excessively long names', () => {
    expect(normalizeChatName('  Weekend crew  ')).toEqual({ ok: true, value: 'Weekend crew' })
    expect(normalizeChatName('   ')).toEqual({ ok: false, error: 'Enter a chat name.' })
    expect(normalizeChatName('a'.repeat(81))).toEqual({
      ok: false,
      error: 'Chat names must be 80 characters or fewer.'
    })
  })

  it('keeps pinned chats first with deterministic tie breakers', () => {
    const sections = getChatLibrarySections([
      chat('older', { lastMessageTime: '2026-08-20T00:00:00.000Z' }),
      chat('same-b', { isPinned: true, pinnedAt: 100 }),
      chat('same-a', { isPinned: true, pinnedAt: 100 }),
      chat('newer', { lastMessageTime: '2026-08-22T00:00:00.000Z' })
    ])

    expect(sections.active.map(item => item.id)).toEqual(['same-a', 'same-b', 'newer', 'older'])
  })

  it('separates archived chats from the active library', () => {
    const sections = getChatLibrarySections([chat('visible'), chat('hidden', { isArchived: true })])

    expect(sections.active.map(item => item.id)).toEqual(['visible'])
    expect(sections.archived.map(item => item.id)).toEqual(['hidden'])
  })
})
