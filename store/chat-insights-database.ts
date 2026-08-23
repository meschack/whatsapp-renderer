import { getArchiveDatabase } from './archive-database'
import type {
  ActivityInsight,
  ChatInsights,
  ConversationStreak,
  EmojiInsight,
  MediaInsight,
  ParticipantInsight
} from '../utils/chat-insights'

interface OverviewRow {
  totalMessages: number
  firstMessageAt: number | null
  lastMessageAt: number | null
}

export async function getChatInsights(chatId: string): Promise<ChatInsights> {
  if (!chatId) {
    return {
      totalMessages: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      participants: [],
      media: [],
      activity: [],
      topEmojis: [],
      longestStreak: null
    }
  }

  const db = getArchiveDatabase()
  const [overview, participants, media, activity, topEmojis, longestStreak] = await Promise.all([
    db.getFirstAsync<OverviewRow>(
      `SELECT COUNT(*) AS totalMessages,
              MIN(timestamp) AS firstMessageAt,
              MAX(timestamp) AS lastMessageAt
       FROM messages
       WHERE chatId = ? AND isSystem = 0`,
      chatId
    ),
    db.getAllAsync<ParticipantInsight>(
      `SELECT sender AS name, COUNT(*) AS messageCount
       FROM messages
       WHERE chatId = ? AND isSystem = 0 AND sender IS NOT NULL
       GROUP BY sender
       ORDER BY messageCount DESC, name ASC`,
      chatId
    ),
    db.getAllAsync<MediaInsight>(
      `SELECT mediaType AS type, COUNT(*) AS count
       FROM messages
       WHERE chatId = ? AND isSystem = 0 AND mediaType IS NOT NULL
       GROUP BY mediaType
       ORDER BY count DESC, type ASC`,
      chatId
    ),
    db.getAllAsync<ActivityInsight>(
      `SELECT CAST(strftime('%w', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) AS weekday,
              CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
              COUNT(*) AS count
       FROM messages
       WHERE chatId = ? AND isSystem = 0
       GROUP BY weekday, hour
       ORDER BY weekday ASC, hour ASC`,
      chatId
    ),
    db.getAllAsync<EmojiInsight>(
      `WITH RECURSIVE
         source(id, rest) AS (
           SELECT id, substr(text, 1, 500)
           FROM messages
           WHERE chatId = ? AND isSystem = 0 AND text IS NOT NULL AND text != ''
         ),
         characters(id, emoji, rest) AS (
           SELECT id, substr(rest, 1, 1), substr(rest, 2)
           FROM source WHERE length(rest) > 0
           UNION ALL
           SELECT id, substr(rest, 1, 1), substr(rest, 2)
           FROM characters WHERE length(rest) > 0
         )
       SELECT emoji, COUNT(*) AS count
       FROM characters
       WHERE ((unicode(emoji) BETWEEN 127744 AND 129791)
          OR (unicode(emoji) BETWEEN 9728 AND 10175))
         AND unicode(emoji) NOT BETWEEN 127995 AND 127999
       GROUP BY emoji
       ORDER BY count DESC, emoji ASC
       LIMIT 8`,
      chatId
    ),
    db.getFirstAsync<ConversationStreak>(
      `WITH message_days AS (
         SELECT DISTINCT date(timestamp / 1000, 'unixepoch', 'localtime') AS dayKey
         FROM messages
         WHERE chatId = ? AND isSystem = 0
       ),
       numbered_days AS (
         SELECT dayKey,
                CAST(julianday(dayKey) AS INTEGER) - ROW_NUMBER() OVER (ORDER BY dayKey) AS island
         FROM message_days
       ),
       streaks AS (
         SELECT COUNT(*) AS dayCount, MIN(dayKey) AS startDay, MAX(dayKey) AS endDay
         FROM numbered_days
         GROUP BY island
       )
       SELECT dayCount, startDay, endDay
       FROM streaks
       ORDER BY dayCount DESC, endDay DESC
       LIMIT 1`,
      chatId
    )
  ])

  return {
    totalMessages: overview?.totalMessages ?? 0,
    firstMessageAt: overview?.firstMessageAt ?? null,
    lastMessageAt: overview?.lastMessageAt ?? null,
    participants,
    media,
    activity,
    topEmojis,
    longestStreak
  }
}
