import type { MediaMap, SavedChat } from '@/models/types'
import type { MediaCandidate, MediaIndexProgress } from '@/utils/media-indexer'

type Awaitable<T> = T | Promise<T>

export type ChatImportPhase =
  | 'extracting'
  | 'discovering'
  | 'checking-duplicate'
  | 'indexing-media'
  | 'reading'
  | 'parsing'
  | 'persisting'
  | 'complete'
  | 'rolling-back'

export interface ChatImportProgress {
  phase: ChatImportPhase
  completed: number
  total: number
  phaseCompleted?: number
  phaseTotal?: number
  currentItem?: string
}

export interface ChatImportRequest {
  temporaryArchiveUri: string
  archiveName: string
  onProgress?: (progress: ChatImportProgress) => void
  onDuplicate?: (chat: SavedChat) => Awaitable<DuplicateImportChoice>
  signal?: AbortSignal
}

export interface ChatImportResult {
  chat: SavedChat
  outcome: 'imported' | 'replaced' | 'opened-existing'
}

export type DuplicateImportChoice = 'open' | 'replace' | 'cancel'

export class ImportCancelledError extends Error {
  constructor(message = 'Import cancelled') {
    super(message)
    this.name = 'ImportCancelledError'
  }
}

export interface ChatImportDependencies {
  extractArchive: (archiveUri: string) => Promise<string>
  discoverArchive: (directoryUri: string) => Awaitable<{
    transcriptUri: string
    mediaCandidates: MediaCandidate[]
  }>
  fingerprintArchive: (transcriptUri: string, candidates: MediaCandidate[]) => Awaitable<string>
  findDuplicate: (fingerprint: string) => Awaitable<SavedChat | null>
  indexMedia: (
    candidates: MediaCandidate[],
    directoryUri: string,
    onProgress: (progress: MediaIndexProgress) => void
  ) => Promise<MediaMap>
  openTranscript: (transcriptUri: string) => Awaitable<() => AsyncIterable<string>>
  parseTranscript: (input: {
    chatId: string
    openTranscript: () => AsyncIterable<string>
    mediaMap: MediaMap
    signal?: AbortSignal
  }) => Awaitable<{ participants: string[]; messageCount: number }>
  getLastMessage: (chatId: string) => Awaitable<{ text: string | null; timestamp: number } | null>
  saveChat: (chat: SavedChat) => Awaitable<void>
  replaceChat: (existingChatId: string, replacement: SavedChat) => Awaitable<void>
  deleteChat: (chatId: string) => Awaitable<void>
  deleteMessages: (chatId: string) => Awaitable<void>
  cleanupExtractedDirectory: (directoryUri: string) => Awaitable<void>
  cleanupTemporaryArchive: (archiveUri: string) => Awaitable<void>
  now: () => Date
}

const TOTAL_IMPORT_UNITS = 7

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImportCancelledError()
}

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
    let duplicate: SavedChat | null = null
    let temporaryArchiveCleaned = false
    let completed = 0

    const report = (phase: ChatImportPhase, completedUnits = completed) => {
      request.onProgress?.({ phase, completed: completedUnits, total: TOTAL_IMPORT_UNITS })
    }

    try {
      report('extracting')
      throwIfCancelled(request.signal)
      extractedDirectoryUri = await dependencies.extractArchive(request.temporaryArchiveUri)
      chatId = getChatId(extractedDirectoryUri)
      throwIfCancelled(request.signal)

      completed = 1
      report('discovering')
      const { transcriptUri, mediaCandidates } =
        await dependencies.discoverArchive(extractedDirectoryUri)
      throwIfCancelled(request.signal)

      completed = 2
      report('checking-duplicate')
      const fingerprint = await dependencies.fingerprintArchive(transcriptUri, mediaCandidates)
      throwIfCancelled(request.signal)
      duplicate = await dependencies.findDuplicate(fingerprint)
      throwIfCancelled(request.signal)

      if (duplicate) {
        const choice = (await request.onDuplicate?.(duplicate)) ?? 'cancel'
        throwIfCancelled(request.signal)
        if (choice === 'open') {
          await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
          temporaryArchiveCleaned = true
          await dependencies.cleanupExtractedDirectory(extractedDirectoryUri)
          completed = TOTAL_IMPORT_UNITS
          report('complete')
          return { chat: duplicate, outcome: 'opened-existing' }
        }
        if (choice === 'cancel') throw new ImportCancelledError('Duplicate import cancelled')
      }

      completed = 3
      report('indexing-media')
      const mediaMap = await dependencies.indexMedia(
        mediaCandidates,
        extractedDirectoryUri,
        progress => {
          throwIfCancelled(request.signal)
          request.onProgress?.({
            phase: 'indexing-media',
            completed,
            total: TOTAL_IMPORT_UNITS,
            phaseCompleted: progress.completed,
            phaseTotal: progress.total,
            currentItem: progress.filename
          })
        }
      )
      throwIfCancelled(request.signal)

      completed = 4
      report('reading')
      const openTranscript = await dependencies.openTranscript(transcriptUri)
      throwIfCancelled(request.signal)

      completed = 5
      report('parsing')
      const parsed = await dependencies.parseTranscript({
        chatId,
        openTranscript,
        mediaMap,
        signal: request.signal
      })
      if (parsed.messageCount === 0) throw new Error('No messages found in the chat file.')
      throwIfCancelled(request.signal)
      await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
      temporaryArchiveCleaned = true

      completed = 6
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
        importedAt,
        archiveFingerprint: fingerprint
      }
      if (duplicate) {
        await dependencies.replaceChat(duplicate.id, chat)
        try {
          await dependencies.cleanupExtractedDirectory(duplicate.extractDirUri)
        } catch {
          // Database replacement is already consistent; a stale directory is safe to clean later.
        }
      } else {
        await dependencies.saveChat(chat)
      }

      completed = TOTAL_IMPORT_UNITS
      report('complete')
      return { chat, outcome: duplicate ? 'replaced' : 'imported' }
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
      if (!temporaryArchiveCleaned) {
        rollbackActions.push(() =>
          dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
        )
      }

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
