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
import { discoverChatArchive } from '@/utils/file-scanner'
import { indexMedia } from '@/utils/media-index'
import { parseChat } from '@/utils/parser'
import { openFileTranscript } from '@/utils/transcript-stream'
import { cleanupExtractedChat, cleanupTemporaryArchive, extractZip } from '@/utils/zip-extractor'

export const importChat = createChatImporter({
  extractArchive: extractZip,
  discoverArchive: discoverChatArchive,
  fingerprintArchive,
  findDuplicate: getSavedChatByFingerprint,
  findUpdate: ({ openTranscript, mediaCandidates, signal }) => {
    const candidates = getAllSavedChats()
      .map(chat => ({ chat, recentMessages: getRecentMessages(chat.id, 6) }))
      .filter(candidate => candidate.recentMessages.length > 0)
    return findChatUpdate({
      openTranscript,
      mediaCandidates,
      candidates,
      signal
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
