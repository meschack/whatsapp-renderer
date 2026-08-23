import type { Message, MediaMap } from '@/models/types'
import { insertMessageBatch } from '@/store/message-database'
import { visitWhatsAppChat } from '@/utils/whatsapp-chat-parser'

const BATCH_SIZE = 500

/**
 * Parse a WhatsApp transcript and persist messages in bounded SQLite batches.
 * Transcript interpretation stays pure and testable in whatsapp-chat-parser.
 */
export function parseChat(
  content: string,
  mediaMap: MediaMap,
  chatId: string,
  myName?: string
): { participants: string[]; messageCount: number } {
  let batch: Message[] = []

  const metadata = visitWhatsAppChat(content, mediaMap, myName, message => {
    batch.push(message)

    if (batch.length === BATCH_SIZE) {
      insertMessageBatch(chatId, batch)
      batch = []
    }
  })

  if (batch.length > 0) insertMessageBatch(chatId, batch)
  return metadata
}
