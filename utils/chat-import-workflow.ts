import {
  findAmbiguousMedia,
  unambiguousMediaCandidates,
  type AmbiguousMediaBasename
} from './media-candidates'
import { visitWhatsAppChatStream } from './whatsapp-chat-parser'
import type { ImportDiagnostics, MediaMap, SavedChat } from '@/models/types'
import { getImportedChatName } from './chat-export-name'
import type { ChatUpdateMatch } from './chat-update-matcher'
import type { MediaCandidate, MediaIndexProgress } from '@/utils/media-indexer'

type Awaitable<T> = T | Promise<T>

export type ChatImportPhase =
  | 'extracting'
  | 'discovering'
  | 'matching-chat'
  | 'reviewing'
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
  signal?: AbortSignal
  onReview?: (preview: ChatImportPreview) => Awaitable<boolean>
}

export interface ChatImportPreview {
  repairOnly?: boolean
  outcome: 'imported' | 'updated' | 'up-to-date'
  chatName: string
  targetChat: SavedChat | null
  messageCount: number
  newMessageCount: number
  mediaCount: number
  ambiguousMedia: AmbiguousMediaBasename[]
  ambiguousDateCount: number
  reconciliation: boolean
}

export interface ChatImportResult {
  chat: SavedChat
  outcome: 'imported' | 'updated' | 'up-to-date'
}

export class ImportCancelledError extends Error {
  constructor(message = 'Import cancelled') {
    super(message)
    this.name = 'ImportCancelledError'
  }
}

export interface ChatImportDependencies {
  extractArchive: (
    archiveUri: string,
    signal?: AbortSignal,
    onProgress?: (progress: { completed: number; total: number; filename?: string }) => void
  ) => Promise<string>
  discoverArchive: (
    directoryUri: string,
    signal?: AbortSignal,
    onProgress?: (progress: { completed: number; total: number; filename?: string }) => void
  ) => Awaitable<{
    transcriptUri: string
    transcriptName?: string
    mediaCandidates: MediaCandidate[]
  }>
  fingerprintArchive: (
    transcriptUri: string,
    candidates: MediaCandidate[],
    signal?: AbortSignal
  ) => Awaitable<string>
  findDuplicate: (fingerprint: string) => Awaitable<SavedChat | null>
  findUpdate: (input: {
    openTranscript: () => AsyncIterable<string>
    mediaCandidates: MediaCandidate[]
    signal?: AbortSignal
  }) => Awaitable<ChatUpdateMatch | null>
  indexMedia: (
    candidates: MediaCandidate[],
    directoryUri: string,
    onProgress: (progress: MediaIndexProgress) => void,
    signal?: AbortSignal
  ) => Promise<MediaMap>
  openTranscript: (
    transcriptUri: string,
    signal?: AbortSignal
  ) => Awaitable<() => AsyncIterable<string>>
  parseTranscript: (input: {
    chatId: string
    openTranscript: () => AsyncIterable<string>
    mediaMap: MediaMap
    myName?: string
    skipMessageCount?: number
    signal?: AbortSignal
  }) => Awaitable<{
    participants: string[]
    messageCount: number
    persistedMessageCount?: number
    diagnostics?: ImportDiagnostics
  }>
  getLastMessage: (chatId: string) => Awaitable<{ text: string | null; timestamp: number } | null>
  saveChat: (chat: SavedChat) => Awaitable<void>
  mergeChat: (
    existing: SavedChat,
    staged: SavedChat,
    match: ChatUpdateMatch
  ) => Awaitable<SavedChat>
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

function createParsingMediaMap(candidates: MediaCandidate[], indexedMedia: MediaMap): MediaMap {
  const mediaMap: MediaMap = new Map(
    unambiguousMediaCandidates(candidates).map(candidate => [
      candidate.filename,
      {
        ...candidate,
        width: null,
        height: null,
        duration: null,
        previewUri: null,
        waveform: null
      }
    ])
  )
  for (const [filename, attachment] of indexedMedia) mediaMap.set(filename, attachment)
  return mediaMap
}

async function reviewPlan(request: ChatImportRequest, preview: ChatImportPreview): Promise<void> {
  if (!request.onReview) return
  throwIfCancelled(request.signal)
  let abortListener: (() => void) | undefined
  try {
    const aborted = new Promise<boolean>((_, reject) => {
      abortListener = () => reject(new ImportCancelledError())
      request.signal?.addEventListener('abort', abortListener, { once: true })
    })
    const accepted = await Promise.race([Promise.resolve(request.onReview(preview)), aborted])
    if (!accepted) throw new ImportCancelledError('Import declined during review')
    throwIfCancelled(request.signal)
  } finally {
    if (abortListener) request.signal?.removeEventListener('abort', abortListener)
  }
}

export function createChatImporter(dependencies: ChatImportDependencies) {
  return async function importChat(request: ChatImportRequest): Promise<ChatImportResult> {
    let extractedDirectoryUri: string | null = null
    let chatId: string | null = null
    let temporaryArchiveCleaned = false
    let completed = 0

    const report = (phase: ChatImportPhase, completedUnits = completed) => {
      request.onProgress?.({ phase, completed: completedUnits, total: TOTAL_IMPORT_UNITS })
    }

    try {
      report('extracting')
      throwIfCancelled(request.signal)
      const phaseProgress =
        (phase: ChatImportPhase) =>
        (progress: { completed: number; total: number; filename?: string }) => {
          request.onProgress?.({
            phase,
            completed,
            total: TOTAL_IMPORT_UNITS,
            phaseCompleted: progress.completed,
            phaseTotal: progress.total,
            currentItem: progress.filename
          })
        }
      extractedDirectoryUri = await dependencies.extractArchive(
        request.temporaryArchiveUri,
        request.signal,
        phaseProgress('extracting')
      )
      chatId = getChatId(extractedDirectoryUri)
      throwIfCancelled(request.signal)

      completed = 1
      report('discovering')
      const { transcriptUri, transcriptName, mediaCandidates } = await dependencies.discoverArchive(
        extractedDirectoryUri,
        request.signal,
        phaseProgress('discovering')
      )
      const importedChatName = getImportedChatName(request.archiveName, transcriptName)
      throwIfCancelled(request.signal)

      completed = 2
      report('matching-chat')
      const fingerprint = await dependencies.fingerprintArchive(
        transcriptUri,
        mediaCandidates,
        request.signal
      )
      throwIfCancelled(request.signal)
      const duplicate = await dependencies.findDuplicate(fingerprint)
      throwIfCancelled(request.signal)

      const ambiguousMedia = findAmbiguousMedia(mediaCandidates)
      const reviewExisting = async (chat: SavedChat) => {
        if (request.onReview) report('reviewing')
        await reviewPlan(request, {
          outcome: 'up-to-date',
          chatName: chat.chatName,
          targetChat: chat,
          messageCount: chat.messageCount,
          newMessageCount: 0,
          mediaCount: 0,
          ambiguousMedia,
          ambiguousDateCount: chat.importDiagnostics?.counts['ambiguous-dates'] ?? 0,
          reconciliation: false
        })
      }
      if (duplicate) {
        await reviewExisting(duplicate)
        await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
        temporaryArchiveCleaned = true
        await dependencies.cleanupExtractedDirectory(extractedDirectoryUri)
        completed = TOTAL_IMPORT_UNITS
        report('complete')
        return { chat: duplicate, outcome: 'up-to-date' }
      }

      const openTranscript = await dependencies.openTranscript(transcriptUri, request.signal)
      const update = await dependencies.findUpdate({
        openTranscript,
        mediaCandidates,
        signal: request.signal
      })
      throwIfCancelled(request.signal)
      if (update?.mode === 'append' && update.newMessageCount === 0) {
        await reviewExisting(update.chat)
        await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
        temporaryArchiveCleaned = true
        await dependencies.cleanupExtractedDirectory(extractedDirectoryUri)
        completed = TOTAL_IMPORT_UNITS
        report('complete')
        return { chat: update.chat, outcome: 'up-to-date' }
      }
      const requiredMedia = update ? new Set(update.mediaFilenames) : null
      const safeMediaCandidates = unambiguousMediaCandidates(mediaCandidates)
      const mediaToIndex = requiredMedia
        ? safeMediaCandidates.filter(candidate => requiredMedia.has(candidate.filename))
        : safeMediaCandidates

      if (request.onReview) {
        report('reviewing')
        const metadata = await visitWhatsAppChatStream(
          openTranscript,
          createParsingMediaMap(mediaCandidates, new Map()),
          update?.chat.myName,
          () => {},
          request.signal
        )
        if (metadata.messageCount === 0) throw new Error('No messages found in the chat file.')
        await reviewPlan(request, {
          outcome: update ? 'updated' : 'imported',
          chatName: update?.chat.chatName ?? importedChatName,
          targetChat: update?.chat ?? null,
          messageCount: metadata.messageCount,
          newMessageCount: update?.newMessageCount ?? metadata.messageCount,
          mediaCount: mediaToIndex.length,
          ambiguousMedia,
          ambiguousDateCount: metadata.diagnostics.counts['ambiguous-dates'],
          reconciliation: update?.mode === 'reconcile-latest'
        })
      }
      throwIfCancelled(request.signal)
      completed = 3
      report('indexing-media')
      const mediaMap = await dependencies.indexMedia(
        mediaToIndex,
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
        },
        request.signal
      )
      const parsingMediaMap = createParsingMediaMap(mediaCandidates, mediaMap)
      throwIfCancelled(request.signal)

      completed = 4
      report('reading')
      throwIfCancelled(request.signal)

      completed = 5
      report('parsing')
      const parsed = await dependencies.parseTranscript({
        chatId,
        openTranscript,
        mediaMap: parsingMediaMap,
        myName: update?.chat.myName,
        skipMessageCount: update?.skipMessageCount,
        signal: request.signal
      })
      if (parsed.messageCount === 0) throw new Error('No messages found in the chat file.')
      throwIfCancelled(request.signal)
      await dependencies.cleanupTemporaryArchive(request.temporaryArchiveUri)
      temporaryArchiveCleaned = true

      completed = 6
      report('persisting')
      throwIfCancelled(request.signal)
      const lastMessage = await dependencies.getLastMessage(chatId)
      throwIfCancelled(request.signal)
      const importedAt = dependencies.now().toISOString()
      const chat: SavedChat = {
        id: chatId,
        chatName: update?.chat.chatName ?? importedChatName,
        myName: update?.chat.myName ?? '',
        participants: parsed.participants,
        extractDirUri: extractedDirectoryUri,
        messageCount: parsed.persistedMessageCount ?? parsed.messageCount,
        lastMessageText: lastMessage?.text ?? null,
        lastMessageTime: lastMessage ? new Date(lastMessage.timestamp).toISOString() : importedAt,
        importedAt,
        archiveFingerprint: fingerprint,
        importDiagnostics: parsed.diagnostics
      }
      if (update) {
        const merged = await dependencies.mergeChat(update.chat, chat, update)
        completed = TOTAL_IMPORT_UNITS
        report('complete')
        return { chat: merged, outcome: 'updated' }
      } else {
        await dependencies.saveChat(chat)
      }

      completed = TOTAL_IMPORT_UNITS
      report('complete')
      return { chat, outcome: 'imported' }
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

      if (request.signal?.aborted) throw new ImportCancelledError()
      throw error
    }
  }
}
