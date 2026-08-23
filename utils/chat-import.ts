import {
  deleteSavedChat,
  getSavedChatByFingerprint,
  replaceSavedChat,
  saveChatMetadata
} from '@/store/chat-database'
import { deleteMessages, getLastMessage } from '@/store/message-database'
import { createChatImporter } from '@/utils/chat-import-workflow'
import { fingerprintArchive } from '@/utils/archive-fingerprint'
import { findChatFile, scanForMedia } from '@/utils/file-scanner'
import { indexMedia } from '@/utils/media-index'
import { parseChat } from '@/utils/parser'
import { openFileTranscript } from '@/utils/transcript-stream'
import { cleanupExtractedChat, cleanupTemporaryArchive, extractZip } from '@/utils/zip-extractor'

export const importChat = createChatImporter({
  extractArchive: extractZip,
  discoverArchive: directoryUri => {
    const transcriptUri = findChatFile(directoryUri)
    if (!transcriptUri) {
      throw new Error('No chat file found in the archive. Make sure this is a WhatsApp export.')
    }

    return { transcriptUri, mediaCandidates: scanForMedia(directoryUri) }
  },
  fingerprintArchive,
  findDuplicate: getSavedChatByFingerprint,
  indexMedia,
  openTranscript: openFileTranscript,
  parseTranscript: ({ openTranscript, mediaMap, chatId, signal }) =>
    parseChat(openTranscript, mediaMap, chatId, undefined, signal),
  getLastMessage,
  saveChat: saveChatMetadata,
  replaceChat: replaceSavedChat,
  deleteChat: deleteSavedChat,
  deleteMessages,
  cleanupExtractedDirectory: cleanupExtractedChat,
  cleanupTemporaryArchive,
  now: () => new Date()
})
