import type { MediaMap, Message } from '../models/types'
import {
  visitWhatsAppChatStream,
  type WhatsAppChatMetadata
} from './whatsapp-chat-parser'

export interface IncrementalChatParserDependencies {
  batchSize: number
  writeBatch: (chatId: string, messages: Message[]) => Promise<void>
  yieldToMainThread: () => Promise<void>
}

export interface IncrementalChatParserRequest {
  chatId: string
  openTranscript: () => AsyncIterable<string>
  mediaMap: MediaMap
  myName?: string
}

export function createIncrementalChatParser(dependencies: IncrementalChatParserDependencies) {
  if (!Number.isInteger(dependencies.batchSize) || dependencies.batchSize < 1) {
    throw new Error('Incremental parser batchSize must be a positive integer.')
  }

  return async function parseTranscript(
    request: IncrementalChatParserRequest
  ): Promise<WhatsAppChatMetadata> {
    let batch: Message[] = []

    const flush = async () => {
      if (batch.length === 0) return
      const messages = batch
      batch = []
      await dependencies.writeBatch(request.chatId, messages)
      await dependencies.yieldToMainThread()
    }

    const metadata = await visitWhatsAppChatStream(
      request.openTranscript,
      request.mediaMap,
      request.myName,
      async message => {
        batch.push(message)
        if (batch.length === dependencies.batchSize) await flush()
      }
    )

    await flush()
    return metadata
  }
}
