import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createE2EExportFixtures, createE2ETranscript } from '../utils/e2e-fixture'
import { parseWhatsAppChat } from '../utils/whatsapp-chat-parser'
import { findChatUpdate } from '../utils/chat-update-matcher'
import type { SavedChat } from '../models/types'

describe('portable native smoke fixtures', () => {
  it('generates byte-stable ZIPs with actual image data and documented missing audio', async () => {
    const first = await createE2EExportFixtures()
    const second = await createE2EExportFixtures()
    expect(first.initial).toEqual(second.initial)
    expect(first.update).toEqual(second.update)
    const zip = await JSZip.loadAsync(first.initial)
    const image = await zip.file('fixture-image.png')!.async('uint8array')
    expect([...image.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(zip.file('fixture-audio.opus')).toBeNull()
    expect(await zip.file('_chat.txt')!.async('string')).toBe(createE2ETranscript(1560))
  })
  it('provides over six timeline pages, multiple dates and stable search anchors', () => {
    const parsed = parseWhatsAppChat(createE2ETranscript(1560), new Map())
    expect(parsed.messages).toHaveLength(1560)
    expect(new Set(parsed.messages.map(message => message.timestamp.toDateString())).size).toBe(26)
    expect(parsed.messages[719].text).toContain('E2E message 0720')
    expect(parsed.messages[11].mediaFilename).toBe('fixture-image.png')
    expect(parsed.messages[23].mediaFilename).toBe('fixture-audio.opus')
    expect(parsed.diagnostics.counts['ambiguous-dates']).toBe(0)
  })
  it('proves update continuity through production history matching', async () => {
    const initial = parseWhatsAppChat(createE2ETranscript(1560), new Map())
    const chat: SavedChat = {
      id: 'fixture',
      chatName: 'E2E Archive',
      myName: 'Me',
      participants: initial.participants,
      extractDirUri: 'file:///fixture',
      messageCount: 1560,
      lastMessageText: initial.messages.at(-1)!.text,
      lastMessageTime: initial.messages.at(-1)!.timestamp.toISOString(),
      importedAt: '2026-08-13T00:00:00Z'
    }
    const match = await findChatUpdate({
      openTranscript: async function* () {
        yield createE2ETranscript(1680)
      },
      mediaCandidates: [],
      candidates: [{ chat, recentMessages: initial.messages.slice(-6) }]
    })
    expect(match).toMatchObject({
      chat,
      mode: 'append',
      skipMessageCount: 1560,
      newMessageCount: 120
    })
  })
})
