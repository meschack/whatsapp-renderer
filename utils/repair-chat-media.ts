import { planMediaRepair } from './media-repair-plan'
import { File } from 'expo-file-system'
import { getArchiveDatabase } from '@/store/archive-database'
import { getRecentMessages } from '@/store/message-database'
import type { SavedChat } from '@/models/types'
import { extractZip, cleanupExtractedChat, cleanupTemporaryArchive } from './zip-extractor'
import { discoverChatArchive } from './file-scanner'
import { fingerprintArchive } from './archive-fingerprint'
import { findChatUpdate } from './chat-update-matcher'
import { openFileTranscript } from './transcript-stream'
import { visitWhatsAppChatStream } from './whatsapp-chat-parser'
import { indexMedia } from './media-index'
import { unambiguousMediaCandidates, findAmbiguousMedia } from './media-candidates'
import { throwIfImportAborted } from './import-cancellation'
import {
  ImportCancelledError,
  type ChatImportRequest,
  type ChatImportResult
} from './chat-import-workflow'

/** Repair only missing attachments, preserving message IDs, bookmarks and text. */
export async function repairChatMedia(
  chat: SavedChat,
  request: ChatImportRequest
): Promise<ChatImportResult> {
  let directory: string | null = null
  let committed = false
  const progress = (
    phase: 'extracting' | 'discovering' | 'reviewing' | 'indexing-media' | 'persisting'
  ) => request.onProgress?.({ phase, completed: 0, total: 1 })
  try {
    progress('extracting')
    directory = await extractZip(request.temporaryArchiveUri, request.signal)
    progress('discovering')
    const { transcriptUri, mediaCandidates } = await discoverChatArchive(directory, request.signal)
    const fingerprint = await fingerprintArchive(transcriptUri, mediaCandidates, request.signal)
    const transcript = openFileTranscript(transcriptUri, request.signal)
    const matching =
      fingerprint === chat.archiveFingerprint
        ? true
        : Boolean(
            await findChatUpdate({
              openTranscript: transcript,
              mediaCandidates,
              signal: request.signal,
              candidates: [{ chat, recentMessages: getRecentMessages(chat.id, 6) }]
            })
          )
    if (!matching)
      throw new Error(
        'This export does not prove the same conversation. Choose the latest export of this chat; your saved messages have been kept.'
      )
    const db = getArchiveDatabase()
    const rows = db.getAllSync<{
      id: number
      mediaFilename: string | null
      mediaUri: string | null
    }>(
      'SELECT id, mediaFilename, mediaUri FROM messages WHERE chatId = ? AND mediaType IS NOT NULL',
      chat.id
    )
    const plan = planMediaRepair(rows, unambiguousMediaCandidates(mediaCandidates), uri => {
      try {
        return new File(uri).exists
      } catch {
        return false
      }
    })
    const { missing, candidates } = plan
    if (missing.length > 0 && candidates.length === 0)
      throw new Error(
        plan.conflictingNames.length
          ? 'These attachment names were reused across saved exports. Kinsay cannot safely identify their original files; your saved messages have been kept.'
          : 'No matching attachment files were found. Choose an export that includes media; your saved messages have been kept.'
      )
    progress('reviewing')
    const metadata = await visitWhatsAppChatStream(
      transcript,
      new Map(),
      chat.myName,
      () => {},
      request.signal
    )
    if (
      request.onReview &&
      !(await request.onReview({
        repairOnly: true,
        outcome: 'updated',
        chatName: chat.chatName,
        targetChat: chat,
        messageCount: metadata.messageCount,
        newMessageCount: 0,
        mediaCount: candidates.length,
        ambiguousMedia: [
          ...findAmbiguousMedia(mediaCandidates),
          ...plan.conflictingNames.map(filename => ({
            filename,
            relativePaths: ['Several saved export versions']
          }))
        ],
        ambiguousDateCount: metadata.diagnostics.counts['ambiguous-dates'],
        reconciliation: false
      }))
    )
      throw new ImportCancelledError()
    throwIfImportAborted(request.signal)
    progress('indexing-media')
    const media = await indexMedia(
      candidates,
      directory,
      value =>
        request.onProgress?.({
          phase: 'indexing-media',
          completed: 0,
          total: 1,
          phaseCompleted: value.completed,
          phaseTotal: value.total
        }),
      request.signal
    )
    throwIfImportAborted(request.signal)
    progress('persisting')
    const repaired = { ...chat, extractDirUri: directory }
    db.withTransactionSync(() => {
      for (const row of missing) {
        const attachment = row.mediaFilename ? media.get(row.mediaFilename) : undefined
        if (!attachment) continue
        db.runSync(
          `UPDATE messages SET mediaUri = ?, mediaPreviewUri = ?, mediaWidth = ?, mediaHeight = ?, mediaSize = ?, mediaDuration = ?, mediaWaveform = ? WHERE chatId = ? AND id = ?`,
          attachment.uri,
          attachment.previewUri,
          attachment.width,
          attachment.height,
          attachment.size,
          attachment.duration,
          attachment.waveform ? JSON.stringify(attachment.waveform) : null,
          chat.id,
          row.id
        )
      }
      // Nested saveChatMetadata transacts independently; keep metadata SQL in this transaction.
      db.runSync('UPDATE saved_chats SET extractDirUri = ? WHERE id = ?', directory!, chat.id)
      db.runSync(
        'INSERT OR IGNORE INTO chat_sources (chatId, directoryUri, importedAt) VALUES (?, ?, ?)',
        chat.id,
        directory!,
        new Date().toISOString()
      )
    })
    committed = true
    return { chat: repaired, outcome: 'updated' }
  } finally {
    if (directory && !committed) cleanupExtractedChat(directory)
    await cleanupTemporaryArchive(request.temporaryArchiveUri)
  }
}
