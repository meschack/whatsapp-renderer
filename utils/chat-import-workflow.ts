import type { MediaMap, SavedChat } from '@/models/types'

type Awaitable<T> = T | Promise<T>

export type ChatImportPhase =
  | 'extracting'
  | 'discovering'
  | 'reading'
  | 'parsing'
  | 'persisting'
  | 'complete'
  | 'rolling-back'

export interface ChatImportProgress {
  phase: ChatImportPhase
  completed: number
  total: number
}

export interface ChatImportRequest {
  temporaryArchiveUri: string
  archiveName: string
  onProgress?: (progress: ChatImportProgress) => void
}

export interface ChatImportResult {
  chat: SavedChat
}

export interface ChatImportDependencies {
  extractArchive: (archiveUri: string) => Promise<string>
  discoverArchive: (directoryUri: string) => Awaitable<{
    transcriptUri: string
    mediaMap: MediaMap
  }>
  openTranscript: (transcriptUri: string) => Awaitable<() => AsyncIterable<string>>
  parseTranscript: (input: {
    chatId: string
    openTranscript: () => AsyncIterable<string>
    mediaMap: MediaMap
  }) => Awaitable<{ participants: string[]; messageCount: number }>
  getLastMessage: (chatId: string) => Awaitable<{ text: string | null; timestamp: number } | null>
  saveChat: (chat: SavedChat) => Awaitable<void>
  deleteChat: (chatId: string) => Awaitable<void>
  deleteMessages: (chatId: string) => Awaitable<void>
  cleanupExtractedDirectory: (directoryUri: string) => Awaitable<void>
  cleanupTemporaryArchive: (archiveUri: string) => Awaitable<void>
  now: () => Date
}

const TOTAL_IMPORT_UNITS = 5

function getChatId(directoryUri: string): string {
  const chatId = directoryUri.split('/').filter(Boolean).pop()
  if (!chatId) throw new Error('The extracted chat directory has no usable identifier.')
  return chatId
}

export function getImportedChatName(archiveName: string): string {
  const withoutExtension = archiveName.replace(/\.zip$/i, '')
  const withoutWhatsAppPrefix = withoutExtension.replace(/^WhatsApp Chat\s*-\s*/i, '')
  return withoutWhatsAppPrefix.trim() || 'Chat'
}

export function createChatImporter(dependencies: ChatImportDependencies) {
  return async function importChat(request: ChatImportRequest): Promise<ChatImportResult> {
    let extractedDirectoryUri: string | null = null
    let chatId: string | null = null
    let completed = 0

    const report = (phase: ChatImportPhase, completedUnits = completed) => {
      request.onProgress?.({ phase, completed: completedUnits, total: TOTAL_IMPORT_UNITS })
    }

    try {
      report('extracting')
      extractedDirectoryUri = await dependencies.extractArchive(request.temporaryArchiveUri)
      chatId = getChatId(extractedDirectoryUri)

      completed = 1
      report('discovering')
      const { transcriptUri, mediaMap } = await dependencies.discoverArchive(extractedDirectoryUri)

      completed = 2
      report('reading')
      const openTranscript = await dependencies.openTranscript(transcriptUri)

      completed = 3
      report('parsing')
      const parsed = await dependencies.parseTranscript({ chatId, openTranscript, mediaMap })
      if (parsed.messageCount === 0) throw new Error('No messages found in the chat file.')

      completed = 4
      report('persisting')
      const lastMessage = await dependencies.getLastMessage(chatId)
      const importedAt = dependencies.now().toISOString()
      const chat: SavedChat = {
        id: chatId,
        chatName: getImportedChatName(request.archiveName),
        myName: '',
        participants: parsed.participants,
        extractDirUri: extractedDirectoryUri,
        messageCount: parsed.messageCount,
        lastMessageText: lastMessage?.text ?? null,
        lastMessageTime: lastMessage ? new Date(lastMessage.timestamp).toISOString() : importedAt,
        importedAt
      }
      await dependencies.saveChat(chat)
      await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)

      completed = TOTAL_IMPORT_UNITS
      report('complete')
      return { chat }
    } catch (error) {
      report('rolling-back')

      const rollbackActions: Array<() => Awaitable<void>> = []
      if (chatId) {
        const failedChatId = chatId
        rollbackActions.push(
          () => dependencies.deleteChat(failedChatId),
          () => dependencies.deleteMessages(failedChatId)
        )
      }
      if (extractedDirectoryUri) {
        const failedDirectoryUri = extractedDirectoryUri
        rollbackActions.push(() => dependencies.cleanupExtractedDirectory(failedDirectoryUri))
      }
      rollbackActions.push(() => dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri))

      for (const rollback of rollbackActions) {
        try {
          await rollback()
        } catch {
          // Continue compensating so one failed cleanup cannot strand every other resource.
        }
      }

      throw error
    }
  }
}
