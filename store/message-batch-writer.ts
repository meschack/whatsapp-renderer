import type { Message } from '@/models/types'

type MessageInsertValue = string | number | null

interface MessageInsertStatement {
  executeAsync(...params: MessageInsertValue[]): Promise<unknown>
  finalizeAsync(): Promise<void>
}

export interface MessageInsertDatabase {
  withTransactionAsync(task: () => Promise<void>): Promise<void>
  prepareAsync(source: string): Promise<MessageInsertStatement>
}

const INSERT_MESSAGE_SQL = `INSERT INTO messages (
  chatId, sender, text, mediaType, mediaUri, mediaFilename, mediaSize,
  mediaWidth, mediaHeight, mediaDuration, mediaPreviewUri,
  mediaWaveform, timestamp, isEdited, isMine, isSystem
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

function serializeWaveform(message: Message): string | null {
  if (message.mediaType === 'audio') return JSON.stringify(message.mediaWaveform ?? [])
  return message.mediaWaveform ? JSON.stringify(message.mediaWaveform) : null
}

/**
 * Insert one bounded import batch on the archive's shared connection.
 *
 * A fresh exclusive Expo SQLite transaction opens and closes a native connection.
 * Repeating that for every parser batch can crash 32-bit Android while SQLite closes
 * and finalizes the temporary connection, so imports deliberately transact in place.
 */
export async function insertMessageBatchIntoDatabaseAsync(
  database: MessageInsertDatabase,
  chatId: string,
  messages: Message[]
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const statement = await database.prepareAsync(INSERT_MESSAGE_SQL)
    try {
      for (const message of messages) {
        await statement.executeAsync(
          chatId,
          message.sender,
          message.text,
          message.mediaType,
          message.mediaUri,
          message.mediaFilename,
          message.mediaSize,
          message.mediaWidth,
          message.mediaHeight,
          message.mediaDuration,
          message.mediaPreviewUri,
          serializeWaveform(message),
          message.timestamp.getTime(),
          message.isEdited ? 1 : 0,
          message.isMine ? 1 : 0,
          message.isSystem ? 1 : 0
        )
      }
    } finally {
      await statement.finalizeAsync()
    }
  })
}
