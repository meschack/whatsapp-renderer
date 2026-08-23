import type { MediaMap } from '@/models/types'
import { insertMessageBatchAsync } from '@/store/message-database'
import { createIncrementalChatParser } from '@/utils/incremental-chat-parser'

const BATCH_SIZE = 250

const parseIncrementally = createIncrementalChatParser({
  batchSize: BATCH_SIZE,
  writeBatch: insertMessageBatchAsync,
  yieldToMainThread: () => new Promise(resolve => setTimeout(resolve, 0))
})

/** Parse a repeatable transcript stream and persist bounded asynchronous batches. */
export function parseChat(
  openTranscript: () => AsyncIterable<string>,
  mediaMap: MediaMap,
  chatId: string,
  myName?: string
) {
  return parseIncrementally({ chatId, openTranscript, mediaMap, myName })
}
