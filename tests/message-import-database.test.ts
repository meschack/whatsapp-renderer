import { describe, expect, it, vi } from 'vitest'

import {
  insertMessageBatchIntoDatabaseAsync,
  type MessageInsertDatabase
} from '../store/message-batch-writer'
import type { Message } from '../models/types'

describe('message import database writer', () => {
  it('uses the shared database transaction instead of creating a temporary connection', async () => {
    const executeAsync = vi.fn(async () => undefined)
    const finalizeAsync = vi.fn(async () => undefined)
    const prepareAsync = vi.fn(async () => ({ executeAsync, finalizeAsync }))
    const withTransactionAsync = vi.fn(async (task: () => Promise<void>) => task())
    const database = { prepareAsync, withTransactionAsync } as MessageInsertDatabase
    const messages: Message[] = [
      {
        id: 'import-1',
        sender: 'Alice',
        text: 'Salut',
        mediaType: null,
        mediaUri: null,
        mediaFilename: null,
        mediaSize: null,
        mediaWidth: null,
        mediaHeight: null,
        mediaDuration: null,
        mediaPreviewUri: null,
        mediaWaveform: null,
        timestamp: new Date(2026, 7, 24, 2, 0),
        isEdited: false,
        isMine: true,
        isSystem: false
      }
    ]

    await insertMessageBatchIntoDatabaseAsync(database, 'chat-1', messages)

    expect(withTransactionAsync).toHaveBeenCalledOnce()
    expect(prepareAsync).toHaveBeenCalledOnce()
    expect(executeAsync).toHaveBeenCalledOnce()
    expect(finalizeAsync).toHaveBeenCalledOnce()
  })
})
