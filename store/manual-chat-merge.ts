/** The timeline uses increasing message IDs, so older imports must be resequenced atomically. */
interface MergeDatabase {
  runSync(sql: string, ...params: (string | number | null)[]): unknown
}

const columns = `sender, text, mediaType, mediaUri, mediaFilename, mediaSize,
  mediaWidth, mediaHeight, mediaDuration, mediaPreviewUri, mediaWaveform,
  timestamp, isEdited, isMine, isSystem`
const identity = 'timestamp, sender, text, mediaType, mediaFilename, isEdited, isSystem'

/** Called inside the chat merge transaction; exact repeats retain their occurrence count. */
export function mergeManuallySelectedChat(db: MergeDatabase, existingId: string, stagedId: string) {
  // Keep the maximum number of identical occurrences across exports, rather than
  // collapsing legitimate repeated messages within a single export.
  db.runSync(
    `CREATE TEMP TABLE manual_merge_rows AS
    WITH ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY chatId, ${identity} ORDER BY id) AS occurrence
      FROM messages WHERE chatId IN (?, ?)
    ), combined AS (
      SELECT incoming.* FROM ranked AS incoming
      WHERE incoming.chatId = ? OR NOT EXISTS (
        SELECT 1 FROM ranked AS saved
        WHERE saved.chatId = ? AND saved.occurrence = incoming.occurrence
          AND saved.timestamp IS incoming.timestamp AND saved.sender IS incoming.sender
          AND saved.text IS incoming.text AND saved.mediaType IS incoming.mediaType
          AND saved.mediaFilename IS incoming.mediaFilename AND saved.isEdited IS incoming.isEdited
          AND saved.isSystem IS incoming.isSystem
      )
    )
    SELECT *, id AS originalId,
      (SELECT MAX(COALESCE((SELECT MAX(id) FROM messages), 0),
                  COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'messages'), 0)))
        + ROW_NUMBER() OVER (ORDER BY timestamp, id) AS replacementId
    FROM combined`,
    existingId,
    stagedId,
    existingId,
    existingId
  )
  db.runSync(
    `CREATE TEMP TABLE manual_merge_bookmarks AS
    SELECT r.replacementId AS messageId, b.chatId, b.createdAt
    FROM message_bookmarks b JOIN manual_merge_rows r ON r.originalId = b.messageId
    WHERE b.chatId = ?`,
    existingId
  )
  db.runSync(
    `UPDATE chat_positions SET messageSequence = COALESCE(
    (SELECT replacementId FROM manual_merge_rows WHERE originalId = chat_positions.messageSequence),
    messageSequence) WHERE chatId = ?`,
    existingId
  )
  // Explicit deletion also supports archives created before the bookmark FK existed.
  db.runSync('DELETE FROM message_bookmarks WHERE chatId = ?', existingId)
  db.runSync('DELETE FROM messages WHERE chatId IN (?, ?)', existingId, stagedId)
  db.runSync(
    `INSERT INTO messages (id, chatId, ${columns})
    SELECT replacementId, ?, ${columns} FROM manual_merge_rows ORDER BY replacementId`,
    existingId
  )
  db.runSync(`INSERT INTO message_bookmarks (messageId, chatId, createdAt)
    SELECT messageId, chatId, createdAt FROM manual_merge_bookmarks`)
  db.runSync('DROP TABLE manual_merge_bookmarks')
  db.runSync('DROP TABLE manual_merge_rows')
}
