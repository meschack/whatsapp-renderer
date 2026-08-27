import type { MediaMap, Message } from '../models/types'
import { visitWhatsAppChatStream, type WhatsAppChatMetadata } from './whatsapp-chat-parser'

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
  signal?: AbortSignal
  skipMessageCount?: number
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = new Error('Import cancelled')
  error.name = 'AbortError'
  throw error
}

export function createIncrementalChatParser(dependencies: IncrementalChatParserDependencies) {
  if (!Number.isInteger(dependencies.batchSize) || dependencies.batchSize < 1) {
    throw new Error('Incremental parser batchSize must be a positive integer.')
  }

  return async function parseTranscript(
    request: IncrementalChatParserRequest
  ): Promise<WhatsAppChatMetadata & { persistedMessageCount: number }> {
    const skipMessageCount = request.skipMessageCount ?? 0
    if (!Number.isInteger(skipMessageCount) || skipMessageCount < 0) {
      throw new Error('skipMessageCount must be a non-negative integer.')
    }

    let batch: Message[] = []
    let visitedMessageCount = 0
    let persistedMessageCount = 0

    const flush = async () => {
      throwIfAborted(request.signal)
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
        throwIfAborted(request.signal)
        if (visitedMessageCount++ < skipMessageCount) return
        batch.push(message)
        persistedMessageCount++
        if (batch.length === dependencies.batchSize) await flush()
      }
    )

    throwIfAborted(request.signal)
    await flush()
    return { ...metadata, persistedMessageCount }
  }
}
