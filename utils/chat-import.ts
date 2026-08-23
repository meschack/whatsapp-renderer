import { deleteSavedChat, saveChatMetadata } from '@/store/chat-database'
import { deleteMessages, getLastMessage } from '@/store/message-database'
import { createChatImporter } from '@/utils/chat-import-workflow'
import { findChatFile, scanForMedia } from '@/utils/file-scanner'
import { parseChat } from '@/utils/parser'
import { openFileTranscript } from '@/utils/transcript-stream'
import {
  cleanupExtractedChat,
  cleanupTemporaryArchive,
  extractZip
} from '@/utils/zip-extractor'

export const importChat = createChatImporter({
  extractArchive: extractZip,
  discoverArchive: directoryUri => {
    const transcriptUri = findChatFile(directoryUri)
    if (!transcriptUri) {
      throw new Error('No chat file found in the archive. Make sure this is a WhatsApp export.')
    }

    return { transcriptUri, mediaMap: scanForMedia(directoryUri) }
  },
  openTranscript: openFileTranscript,
  parseTranscript: ({ openTranscript, mediaMap, chatId }) =>
    parseChat(openTranscript, mediaMap, chatId),
  getLastMessage,
  saveChat: saveChatMetadata,
  deleteChat: deleteSavedChat,
  deleteMessages,
  cleanupExtractedDirectory: cleanupExtractedChat,
  cleanupTemporaryArchive,
  now: () => new Date()
})
