import { describe, expect, it } from 'vitest'

import {
  createChatImporter,
  ImportCancelledError,
  type ChatImportDependencies,
  type ChatImportPhase
} from '../utils/chat-import-workflow'
import type { Message, SavedChat } from '../models/types'
import { createArchiveFingerprint } from '../utils/archive-identity'
import { createImportDiagnostics } from '../utils/import-diagnostics'

function createHarness(overrides: Partial<ChatImportDependencies> = {}) {
  const savedChats = new Map<string, SavedChat>()
  const messageChats = new Set<string>()
  const cleanedDirectories: string[] = []
  const cleanedArchives: string[] = []

  const dependencies: ChatImportDependencies = {
    extractArchive: async () => 'file:///documents/whatsapp-chats/chat-42',
    discoverArchive: async () => ({
      transcriptUri: 'file:///documents/whatsapp-chats/chat-42/_chat.txt',
      mediaCandidates: [
        {
          filename: 'photo.jpg',
          uri: 'file:///documents/whatsapp-chats/chat-42/photo.jpg',
          type: 'image',
          size: 100
        }
      ]
    }),
    fingerprintArchive: () => 'v1:transcript:media',
    findDuplicate: () => null,
    findUpdate: () => null,
    indexMedia: async (candidates, _directoryUri, onProgress) => {
      onProgress({ completed: 1, total: 1, filename: candidates[0].filename })
      return new Map([
        [
          'photo.jpg',
          {
            ...candidates[0],
            width: 100,
            height: 80,
            duration: null,
            previewUri: 'file:///documents/whatsapp-chats/chat-42/previews/0.jpg',
            waveform: null
          }
        ]
      ])
    },
    openTranscript: async () =>
      async function* () {
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
    mergeChat: (_existing, staged) => staged,
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
  const duplicateChat: SavedChat = {
    id: 'chat-existing',
    chatName: 'Existing chat',
    myName: 'Me',
    participants: ['Me', 'Alice'],
    extractDirUri: 'file:///documents/whatsapp-chats/chat-existing',
    messageCount: 2,
    lastMessageText: 'See you',
    lastMessageTime: '2026-08-23T04:58:00.000Z',
    importedAt: '2026-08-22T05:00:00.000Z',
    archiveFingerprint: 'v1:transcript:media'
  }

  it('reports measurable phases and creates one complete chat', async () => {
    const harness = createHarness()
    const progress: Array<{
      phase: ChatImportPhase
      completed: number
      total: number
      phaseCompleted?: number
      phaseTotal?: number
      currentItem?: string
    }> = []

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
      importedAt: '2026-08-23T05:00:00.000Z',
      archiveFingerprint: 'v1:transcript:media'
    })
    expect(result.outcome).toBe('imported')
    expect([...harness.savedChats.values()]).toEqual([result.chat])
    expect(harness.messageChats).toEqual(new Set(['chat-42']))
    expect(harness.cleanedDirectories).toEqual([])
    expect(harness.cleanedArchives).toEqual(['file:///cache/armel.zip'])
    expect(progress).toEqual([
      { phase: 'extracting', completed: 0, total: 7 },
      { phase: 'discovering', completed: 1, total: 7 },
      { phase: 'matching-chat', completed: 2, total: 7 },
      { phase: 'indexing-media', completed: 3, total: 7 },
      {
        phase: 'indexing-media',
        completed: 3,
        total: 7,
        phaseCompleted: 1,
        phaseTotal: 1,
        currentItem: 'photo.jpg'
      },
      { phase: 'reading', completed: 4, total: 7 },
      { phase: 'parsing', completed: 5, total: 7 },
      { phase: 'persisting', completed: 6, total: 7 },
      { phase: 'complete', completed: 7, total: 7 }
    ])
  })

  it('preserves parser diagnostics in saved chat metadata', async () => {
    const diagnostics = createImportDiagnostics()
    diagnostics.counts['missing-files'] = 2
    diagnostics.samples['missing-files'] = ['photo.jpg']
    const harness = createHarness({
      parseTranscript: async () => ({
        participants: ['Me', 'Alice'],
        messageCount: 1,
        diagnostics
      })
    })

    const result = await harness.importChat({
      temporaryArchiveUri: 'file:///cache/armel.zip',
      archiveName: 'Armel.zip'
    })

    expect(result.chat.importDiagnostics).toEqual(diagnostics)
    expect(harness.savedChats.get('chat-42')?.importDiagnostics).toEqual(diagnostics)
  })

  it('parses only the suffix and merges it into a chat proven by history', async () => {
    const parsedInputs: Array<{ chatId: string; myName?: string; skipMessageCount?: number }> = []
    const parsingMediaFilenames: string[][] = []
    const indexedFilenames: string[] = []
    const mergedChat: SavedChat = {
      ...duplicateChat,
      messageCount: 3,
      lastMessageText: 'new message',
      lastMessageTime: '2026-08-23T05:01:00.000Z',
      importedAt: '2026-08-23T05:00:00.000Z',
      archiveFingerprint: 'v1:transcript:media'
    }
    const harness = createHarness({
      discoverArchive: () => ({
        transcriptUri: 'file:///documents/whatsapp-chats/chat-42/_chat.txt',
        mediaCandidates: [
          {
            filename: 'old-photo.jpg',
            uri: 'file:///documents/whatsapp-chats/chat-42/old-photo.jpg',
            type: 'image',
            size: 90
          },
          {
            filename: 'photo.jpg',
            uri: 'file:///documents/whatsapp-chats/chat-42/photo.jpg',
            type: 'image',
            size: 100
          }
        ]
      }),
      findUpdate: () => ({
        chat: duplicateChat,
        mode: 'append',
        skipMessageCount: 2,
        newMessageCount: 1,
        mediaFilenames: ['photo.jpg']
      }),
      indexMedia: async candidates => {
        indexedFilenames.push(...candidates.map(candidate => candidate.filename))
        return new Map()
      },
      parseTranscript: async input => {
        parsedInputs.push(input)
        parsingMediaFilenames.push([...input.mediaMap.keys()])
        return {
          participants: ['Me', 'Alice'],
          messageCount: 3,
          persistedMessageCount: 1
        }
      },
      mergeChat: () => mergedChat
    })

    const result = await harness.importChat({
      temporaryArchiveUri: 'file:///cache/alice-update.zip',
      archiveName: 'Discussion WhatsApp avec Alice.zip'
    })

    expect(indexedFilenames).toEqual(['photo.jpg'])
    expect(parsingMediaFilenames).toEqual([['old-photo.jpg', 'photo.jpg']])
    expect(parsedInputs).toEqual([
      {
        chatId: 'chat-42',
        myName: 'Me',
        skipMessageCount: 2,
        openTranscript: expect.any(Function),
        mediaMap: expect.any(Map),
        signal: undefined
      }
    ])
    expect(result).toEqual({ chat: mergedChat, outcome: 'updated' })
  })

  it('treats a history match with no later messages as already up to date', async () => {
    let indexCalls = 0
    let parseCalls = 0
    const harness = createHarness({
      findUpdate: () => ({
        chat: duplicateChat,
        mode: 'append',
        skipMessageCount: 2,
        newMessageCount: 0,
        mediaFilenames: []
      }),
      indexMedia: async () => {
        indexCalls++
        return new Map()
      },
      parseTranscript: async () => {
        parseCalls++
        return { participants: [], messageCount: 0 }
      }
    })

    const result = await harness.importChat({
      temporaryArchiveUri: 'file:///cache/same-history.zip',
      archiveName: 'Alice.zip'
    })

    expect(result).toEqual({ chat: duplicateChat, outcome: 'up-to-date' })
    expect(indexCalls).toBe(0)
    expect(parseCalls).toBe(0)
    expect(harness.cleanedDirectories).toEqual(['file:///documents/whatsapp-chats/chat-42'])
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
      mediaFilename: null,
      mediaSize: null,
      mediaWidth: null,
      mediaHeight: null,
      mediaDuration: null,
      mediaPreviewUri: null,
      mediaWaveform: null,
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
      harness.importChat({
        temporaryArchiveUri: 'file:///cache/broken.zip',
        archiveName: 'broken.zip'
      })
    ).rejects.toThrow('cannot read transcript')

    expect(calls).toEqual(['metadata', 'messages', 'directory', 'archive'])
  })

  it('opens equivalent content as up to date without indexing or parsing it again', async () => {
    let parseCalls = 0
    const harness = createHarness({
      findDuplicate: () => duplicateChat,
      parseTranscript: async () => {
        parseCalls += 1
        return { participants: [], messageCount: 0 }
      }
    })

    const result = await harness.importChat({
      temporaryArchiveUri: 'file:///cache/renamed-export.zip',
      archiveName: 'totally-different-name.zip'
    })

    expect(result).toEqual({ chat: duplicateChat, outcome: 'up-to-date' })
    expect(parseCalls).toBe(0)
    expect(harness.cleanedDirectories).toEqual(['file:///documents/whatsapp-chats/chat-42'])
    expect(harness.cleanedArchives).toEqual(['file:///cache/renamed-export.zip'])
  })

  it('cancels future work promptly and rolls partial state back', async () => {
    const controller = new AbortController()
    let parseCalls = 0
    const harness = createHarness({
      indexMedia: async (candidates, _directory, onProgress) => {
        controller.abort()
        onProgress({ completed: 1, total: candidates.length, filename: candidates[0].filename })
        return new Map()
      },
      parseTranscript: async () => {
        parseCalls += 1
        return { participants: [], messageCount: 0 }
      }
    })

    await expect(
      harness.importChat({
        temporaryArchiveUri: 'file:///cache/cancel.zip',
        archiveName: 'cancel.zip',
        signal: controller.signal
      })
    ).rejects.toBeInstanceOf(ImportCancelledError)

    expect(parseCalls).toBe(0)
    expect(harness.cleanedDirectories).toEqual(['file:///documents/whatsapp-chats/chat-42'])
    expect(harness.cleanedArchives).toEqual(['file:///cache/cancel.zip'])
  })

  it('derives identity from transcript and media content, not archive naming', () => {
    const candidates = [
      { filename: 'b.jpg', uri: 'file:///b.jpg', type: 'image' as const, size: 20 },
      { filename: 'a.opus', uri: 'file:///a.opus', type: 'audio' as const, size: 10 }
    ]

    expect(createArchiveFingerprint('same-transcript', candidates)).toBe(
      createArchiveFingerprint('same-transcript', [...candidates].reverse())
    )
    expect(createArchiveFingerprint('different-transcript', candidates)).not.toBe(
      createArchiveFingerprint('same-transcript', candidates)
    )
  })
})
