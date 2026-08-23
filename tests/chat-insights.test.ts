import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const databaseState = vi.hoisted(() => ({ database: null as TestInsightsDatabase | null }))

vi.mock('../store/archive-database', () => ({
  getArchiveDatabase: () => databaseState.database
}))

import { getChatInsights } from '../store/chat-insights-database'
import { buildHeatmapPeriods, getBusiestHour, getBusiestWeekday } from '../utils/chat-insights'

class TestInsightsDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }

  async getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]> {
    return this.database.prepare(source).all(...params) as T[]
  }
}

describe('chat insights database', () => {
  let sqlite: DatabaseSync
  const originalTimezone = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'UTC'
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        chatId TEXT NOT NULL,
        sender TEXT,
        text TEXT,
        mediaType TEXT,
        timestamp INTEGER NOT NULL,
        isSystem INTEGER NOT NULL DEFAULT 0
      );
    `)
    const insert = sqlite.prepare(
      `INSERT INTO messages
       (id, chatId, sender, text, mediaType, timestamp, isSystem)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    insert.run(1, 'chat-1', 'Alice', 'Hi 😀😀', 'image', Date.UTC(2026, 0, 1, 9), 0)
    insert.run(2, 'chat-1', 'Bob', 'Morning 😀 🔥', null, Date.UTC(2026, 0, 1, 10), 0)
    insert.run(3, 'chat-1', 'Alice', 'Again 🔥', null, Date.UTC(2026, 0, 2, 10), 0)
    insert.run(4, 'chat-1', 'Alice', 'More 🔥🔥', null, Date.UTC(2026, 0, 3, 10), 0)
    insert.run(5, 'chat-1', 'Bob', 'Party 🎉', 'audio', Date.UTC(2026, 0, 5, 18), 0)
    insert.run(6, 'chat-1', null, 'System notice 😀', null, Date.UTC(2026, 0, 5, 19), 1)
    insert.run(7, 'other-chat', 'Alice', 'Ignore 🔥', null, Date.UTC(2026, 0, 1, 10), 0)
    databaseState.database = new TestInsightsDatabase(sqlite)
  })

  afterEach(() => {
    databaseState.database = null
    sqlite.close()
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  })

  it('returns fixture-backed participant, period, emoji, media, and streak metrics', async () => {
    const insights = await getChatInsights('chat-1')

    expect(insights.totalMessages).toBe(5)
    expect(insights.firstMessageAt).toBe(Date.UTC(2026, 0, 1, 9))
    expect(insights.lastMessageAt).toBe(Date.UTC(2026, 0, 5, 18))
    expect(insights.participants).toEqual([
      { name: 'Alice', messageCount: 3 },
      { name: 'Bob', messageCount: 2 }
    ])
    expect(insights.media).toEqual([
      { type: 'audio', count: 1 },
      { type: 'image', count: 1 }
    ])
    expect(insights.topEmojis).toEqual([
      { emoji: '🔥', count: 4 },
      { emoji: '😀', count: 3 },
      { emoji: '🎉', count: 1 }
    ])
    expect(insights.longestStreak).toEqual({
      dayCount: 3,
      startDay: '2026-01-01',
      endDay: '2026-01-03'
    })
    expect(getBusiestWeekday(insights.activity)).toEqual({ weekday: 4, count: 2 })
    expect(getBusiestHour(insights.activity)).toEqual({ hour: 10, count: 3 })
    expect(buildHeatmapPeriods(insights.activity)).toHaveLength(28)
    expect(
      buildHeatmapPeriods(insights.activity).find(cell => cell.weekday === 4 && cell.period === 1)
    ).toMatchObject({ count: 2 })
  })

  it('returns a complete empty state without leaking other chats', async () => {
    await expect(getChatInsights('missing')).resolves.toEqual({
      totalMessages: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      participants: [],
      media: [],
      activity: [],
      topEmojis: [],
      longestStreak: null
    })
  })
})
