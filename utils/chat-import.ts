import {
  deleteSavedChat,
  getAllSavedChats,
  getSavedChatByFingerprint,
  mergeSavedChatUpdate,
  saveChatMetadata
} from '@/store/chat-database'
import { deleteMessages, getLastMessage, getRecentMessages } from '@/store/message-database'
import { createChatImporter } from '@/utils/chat-import-workflow'
import { findChatUpdate } from '@/utils/chat-update-matcher'
import { fingerprintArchive } from '@/utils/archive-fingerprint'
import { findChatFile, scanForMedia } from '@/utils/file-scanner'
import { indexMedia } from '@/utils/media-index'
import { parseChat } from '@/utils/parser'
import { openFileTranscript } from '@/utils/transcript-stream'
import { cleanupExtractedChat, cleanupTemporaryArchive, extractZip } from '@/utils/zip-extractor'

function filenameFromUri(uri: string): string {
  const filename = uri.split('/').pop() ?? ''
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}

export const importChat = createChatImporter({
  extractArchive: extractZip,
  discoverArchive: directoryUri => {
    const transcriptUri = findChatFile(directoryUri)
    if (!transcriptUri) {
      throw new Error('No chat file found in the archive. Make sure this is a WhatsApp export.')
    }

    const transcriptName = filenameFromUri(transcriptUri)
    return { transcriptUri, transcriptName, mediaCandidates: scanForMedia(directoryUri) }
  },
  fingerprintArchive,
  findDuplicate: getSavedChatByFingerprint,
  findUpdate: ({ openTranscript, mediaCandidates }) => {
    const candidates = getAllSavedChats()
      .map(chat => ({ chat, recentMessages: getRecentMessages(chat.id, 6) }))
      .filter(candidate => candidate.recentMessages.length > 0)
    return findChatUpdate({
      openTranscript,
      mediaCandidates,
      candidates
    })
  },
  indexMedia,
  openTranscript: openFileTranscript,
  parseTranscript: ({ openTranscript, mediaMap, chatId, myName, skipMessageCount, signal }) =>
    parseChat(openTranscript, mediaMap, chatId, myName, signal, skipMessageCount),
  getLastMessage,
  saveChat: saveChatMetadata,
  mergeChat: mergeSavedChatUpdate,
  deleteChat: deleteSavedChat,
  deleteMessages,
  cleanupExtractedDirectory: cleanupExtractedChat,
  cleanupTemporaryArchive,
  now: () => new Date()
})
