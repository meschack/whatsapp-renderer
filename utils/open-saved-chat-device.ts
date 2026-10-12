import { throwIfImportAborted } from './import-cancellation'
import { Directory } from 'expo-file-system'
import { getChatSourceDirectories } from '@/store/chat-database'
import {
  applyMediaAttachmentIndex,
  deleteMessages,
  getMessageCount,
  getParticipants,
  getUnindexedMediaUris,
  hasMessages
} from '@/store/message-database'
import { findChatFile, scanForMedia } from './file-scanner'
import { indexMedia } from './media-index'
import { parseChat } from './parser'
import { openFileTranscript } from './transcript-stream'
import { openSavedChat } from './open-saved-chat'
import type { MediaMap, SavedChat } from '@/models/types'

export async function openSavedChatFromDevice(
  chat: SavedChat,
  onStatus: (status: string) => void,
  signal?: AbortSignal
) {
  let mediaMap: MediaMap = new Map()
  const result = await openSavedChat(chat, {
    sourceDirectories: getChatSourceDirectories,
    directoryExists: uri => new Directory(uri).exists,
    hasMessages,
    messageCount: getMessageCount,
    participants: getParticipants,
    async prepareMedia(current, sources, migrate) {
      throwIfImportAborted(signal)
      const pending = migrate ? null : await getUnindexedMediaUris(current.id)
      throwIfImportAborted(signal)
      if (!migrate && !pending?.size) return
      onStatus('Preparing media previews…')
      // Index each retained source separately: later exports can reuse a basename,
      // while each stored message already identifies its particular source URI.
      for (const source of sources) {
        throwIfImportAborted(signal)
        const candidates = scanForMedia(source).filter(item => !pending || pending.has(item.uri))
        const indexed = await indexMedia(
          candidates,
          source,
          progress =>
            onStatus(`Preparing media previews · ${progress.completed}/${progress.total}`),
          signal,
          migrate ? undefined : attachment => applyMediaAttachmentIndex(current.id, attachment)
        )
        if (migrate && source === sources[0]) mediaMap = indexed
      }
    },
    async migrateMessages(current, sources) {
      throwIfImportAborted(signal)
      const transcript = sources.map(findChatFile).find(Boolean)
      if (!transcript)
        throw new Error(
          'The transcript is missing. Your chat entry has been kept; restore the original export to read it.'
        )
      onStatus('Preparing saved messages…')
      try {
        await parseChat(
          openFileTranscript(transcript),
          mediaMap,
          current.id,
          current.myName,
          signal
        )
      } catch (error) {
        deleteMessages(current.id)
        throw error
      }
    }
  })
  throwIfImportAborted(signal)
  return result
}
