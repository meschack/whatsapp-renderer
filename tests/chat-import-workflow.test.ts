import { describe, expect, it } from 'vitest'

import {
  createChatImporter,
  type ChatImportDependencies,
  type ChatImportPhase
} from '../utils/chat-import-workflow'
import type { Message, SavedChat } from '../models/types'

function createHarness(overrides: Partial<ChatImportDependencies> = {}) {
  const savedChats = new Map<string, SavedChat>()
  const messageChats = new Set<string>()
  const cleanedDirectories: string[] = []
  const cleanedArchives: string[] = []

  const dependencies: ChatImportDependencies = {
    extractArchive: async () => 'file:///documents/whatsapp-chats/chat-42',
    discoverArchive: async () => ({
      transcriptUri: 'file:///documents/whatsapp-chats/chat-42/_chat.txt',
      mediaMap: new Map([['photo.jpg', 'file:///documents/whatsapp-chats/chat-42/photo.jpg']])
    }),
    openTranscript: async () => async function* () {
      yield 'transcript'
    },
    parseTranscript: async ({ chatId }) => {
      messageChats.add(chatId)
      return { participants: ['Me', 'Alice'], messageCount: 2 }
    },
    getLastMessage: () => ({ text: 'See you', timestamp: Date.parse('2026-08-23T04:58:00.000Z') }),
    saveChat: chat => {
      savedChats.set(chat.id, chat)
    },
    deleteChat: chatId => {
      savedChats.delete(chatId)
    },
    deleteMessages: chatId => {
      messageChats.delete(chatId)
    },
    cleanupExtractedDirectory: directoryUri => {
      cleanedDirectories.push(directoryUri)
    },
    cleanupTemporaryArchive: archiveUri => {
      cleanedArchives.push(archiveUri)
    },
    now: () => new Date('2026-08-23T05:00:00.000Z'),
    ...overrides
  }

  return {
    importChat: createChatImporter(dependencies),
    savedChats,
    messageChats,
    cleanedDirectories,
    cleanedArchives
  }
}

describe('chat import workflow', () => {
  it('reports measurable phases and creates one complete chat', async () => {
    const harness = createHarness()
    const progress: Array<{ phase: ChatImportPhase; completed: number; total: number }> = []

    const result = await harness.importChat({
      temporaryArchiveUri: 'file:///cache/armel.zip',
      archiveName: 'WhatsApp Chat - Armel.zip',
      onProgress: update => progress.push(update)
    })

    expect(result.chat).toEqual({
      id: 'chat-42',
      chatName: 'Armel',
      myName: '',
      participants: ['Me', 'Alice'],
      extractDirUri: 'file:///documents/whatsapp-chats/chat-42',
      messageCount: 2,
      lastMessageText: 'See you',
      lastMessageTime: '2026-08-23T04:58:00.000Z',
      importedAt: '2026-08-23T05:00:00.000Z'
    })
    expect([...harness.savedChats.values()]).toEqual([result.chat])
    expect(harness.messageChats).toEqual(new Set(['chat-42']))
    expect(harness.cleanedDirectories).toEqual([])
    expect(harness.cleanedArchives).toEqual(['file:///cache/armel.zip'])
    expect(progress).toEqual([
      { phase: 'extracting', completed: 0, total: 5 },
      { phase: 'discovering', completed: 1, total: 5 },
      { phase: 'reading', completed: 2, total: 5 },
      { phase: 'parsing', completed: 3, total: 5 },
      { phase: 'persisting', completed: 4, total: 5 },
      { phase: 'complete', completed: 5, total: 5 }
    ])
  })

  it('removes partial messages, metadata, the extracted directory, and the temporary archive', async () => {
    const savedChats = new Map<string, SavedChat>()
    const messageChats = new Set<string>()
    const rollbackCalls: string[] = []
    const partialMessage: Message = {
      id: 'partial',
      sender: 'Alice',
      text: 'half written',
      mediaType: null,
      mediaUri: null,
      timestamp: new Date(),
      isEdited: false,
      isMine: false,
      isSystem: false
    }

    const harness = createHarness({
      parseTranscript: async ({ chatId }) => {
        messageChats.add(`${chatId}:${partialMessage.id}`)
        throw new Error('parser exploded')
      },
      saveChat: chat => {
        savedChats.set(chat.id, chat)
      },
      deleteChat: chatId => {
        rollbackCalls.push(`metadata:${chatId}`)
        savedChats.delete(chatId)
      },
      deleteMessages: chatId => {
        rollbackCalls.push(`messages:${chatId}`)
        for (const key of messageChats) {
          if (key.startsWith(`${chatId}:`)) messageChats.delete(key)
        }
      },
      cleanupExtractedDirectory: directoryUri => {
        rollbackCalls.push(`directory:${directoryUri}`)
      },
      cleanupTemporaryArchive: archiveUri => {
        rollbackCalls.push(`archive:${archiveUri}`)
      }
    })
    const phases: ChatImportPhase[] = []

    await expect(
      harness.importChat({
        temporaryArchiveUri: 'file:///cache/broken.zip',
        archiveName: 'broken.zip',
        onProgress: update => phases.push(update.phase)
      })
    ).rejects.toThrow('parser exploded')

    expect(savedChats.size).toBe(0)
    expect(messageChats.size).toBe(0)
    expect(rollbackCalls).toEqual([
      'metadata:chat-42',
      'messages:chat-42',
      'directory:file:///documents/whatsapp-chats/chat-42',
      'archive:file:///cache/broken.zip'
    ])
    expect(phases.at(-1)).toBe('rolling-back')
  })

  it('attempts every rollback action even when one cleanup fails', async () => {
    const calls: string[] = []
    const harness = createHarness({
      openTranscript: async () => {
        throw new Error('cannot read transcript')
      },
      deleteChat: () => {
        calls.push('metadata')
        throw new Error('metadata cleanup failed')
      },
      deleteMessages: () => {
        calls.push('messages')
      },
      cleanupExtractedDirectory: () => {
        calls.push('directory')
      },
      cleanupTemporaryArchive: () => {
        calls.push('archive')
      }
    })

    await expect(
      harness.importChat({ temporaryArchiveUri: 'file:///cache/broken.zip', archiveName: 'broken.zip' })
    ).rejects.toThrow('cannot read transcript')

    expect(calls).toEqual(['metadata', 'messages', 'directory', 'archive'])
  })
})
