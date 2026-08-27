import { describe, expect, it } from 'vitest'

import { findChatUpdate } from '../utils/chat-update-matcher'
import type { Message, SavedChat } from '../models/types'

const existingChat: SavedChat = {
  id: 'chat-existing',
  chatName: 'Alice',
  myName: 'Me',
  participants: ['Me', 'Alice'],
  extractDirUri: 'file:///old-chat',
  messageCount: 6,
  lastMessageText: 'old-5',
  lastMessageTime: '2026-08-20T08:05:00.000Z',
  importedAt: '2026-08-20T09:00:00.000Z'
}

function message(index: number, text = `old-${index}`): Message {
  return {
    id: `msg-${index}`,
    sender: index % 2 === 0 ? 'Me' : 'Alice',
    text,
    mediaType: null,
    mediaUri: null,
    mediaFilename: null,
    mediaSize: null,
    mediaWidth: null,
    mediaHeight: null,
    mediaDuration: null,
    mediaPreviewUri: null,
    mediaWaveform: null,
    timestamp: new Date(2026, 7, 20, 8, index),
    isEdited: false,
    isMine: index % 2 === 0,
    isSystem: false
  }
}

function transcript(lines: string[]): () => AsyncIterable<string> {
  return async function* () {
    yield lines.join('\n')
  }
}

describe('chat update matcher', () => {
  it('finds the stored tail and returns only the messages and media after it', async () => {
    const lines = Array.from(
      { length: 6 },
      (_, index) => `20/08/2026, 08:0${index} - ${index % 2 === 0 ? 'Me' : 'Alice'}: old-${index}`
    )
    lines.push(
      '20/08/2026, 08:06 - Me: photo.jpg (fichier joint)',
      '20/08/2026, 08:07 - Alice: new-7'
    )

    const match = await findChatUpdate({
      openTranscript: transcript(lines),
      mediaCandidates: [
        { filename: 'photo.jpg', uri: 'file:///new-chat/photo.jpg', type: 'image', size: 100 }
      ],
      candidates: [
        { chat: existingChat, recentMessages: Array.from({ length: 6 }, (_, i) => message(i)) }
      ]
    })

    expect(match).toEqual({
      chat: existingChat,
      mode: 'append',
      skipMessageCount: 6,
      newMessageCount: 2,
      mediaFilenames: ['photo.jpg']
    })
  })

  it('reconciles a changed latest message only after five preceding messages agree', async () => {
    const lines = Array.from(
      { length: 5 },
      (_, index) => `20/08/2026, 08:0${index} - ${index % 2 === 0 ? 'Me' : 'Alice'}: old-${index}`
    )
    lines.push(
      '20/08/2026, 08:05 - Alice: corrected-5 <Ce message a été modifié>',
      '20/08/2026, 08:06 - Me: new-6'
    )

    const match = await findChatUpdate({
      openTranscript: transcript(lines),
      mediaCandidates: [],
      candidates: [
        { chat: existingChat, recentMessages: Array.from({ length: 6 }, (_, i) => message(i)) }
      ]
    })

    expect(match).toEqual({
      chat: existingChat,
      mode: 'reconcile-latest',
      skipMessageCount: 5,
      newMessageCount: 1,
      mediaFilenames: []
    })
  })

  it('refuses an edited-message guess without five preceding anchors', async () => {
    const lines = Array.from(
      { length: 4 },
      (_, index) => `20/08/2026, 08:0${index} - ${index % 2 === 0 ? 'Me' : 'Alice'}: old-${index}`
    )
    lines.push('20/08/2026, 08:04 - Me: maybe corrected')

    const match = await findChatUpdate({
      openTranscript: transcript(lines),
      mediaCandidates: [],
      candidates: [
        { chat: existingChat, recentMessages: Array.from({ length: 5 }, (_, i) => message(i)) }
      ]
    })

    expect(match).toBeNull()
  })

  it('refuses an ambiguous history anchor shared by two stored chats', async () => {
    const lines = Array.from(
      { length: 6 },
      (_, index) => `20/08/2026, 08:0${index} - ${index % 2 === 0 ? 'Me' : 'Alice'}: old-${index}`
    )
    const recentMessages = Array.from({ length: 6 }, (_, index) => message(index))

    const match = await findChatUpdate({
      openTranscript: transcript(lines),
      mediaCandidates: [],
      candidates: [
        { chat: existingChat, recentMessages },
        { chat: { ...existingChat, id: 'chat-twin', chatName: 'Same name' }, recentMessages }
      ]
    })

    expect(match).toBeNull()
  })
})
