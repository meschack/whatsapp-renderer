import type { MediaType } from '../models/types'

export interface ParticipantInsight {
  name: string
  messageCount: number
}

export interface MediaInsight {
  type: MediaType
  count: number
}

export interface ActivityInsight {
  weekday: number
  hour: number
  count: number
}

export interface EmojiInsight {
  emoji: string
  count: number
}

export interface ConversationStreak {
  dayCount: number
  startDay: string
  endDay: string
}

export interface ChatInsights {
  totalMessages: number
  firstMessageAt: number | null
  lastMessageAt: number | null
  participants: ParticipantInsight[]
  media: MediaInsight[]
  activity: ActivityInsight[]
  topEmojis: EmojiInsight[]
  longestStreak: ConversationStreak | null
}

export interface HeatmapPeriod {
  weekday: number
  period: number
  count: number
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const PERIOD_LABELS = ['00–05', '06–11', '12–17', '18–23'] as const

export function buildHeatmapPeriods(activity: ActivityInsight[]): HeatmapPeriod[] {
  const counts = new Map<string, number>()
  for (const bucket of activity) {
    const period = Math.floor(bucket.hour / 6)
    const key = `${bucket.weekday}-${period}`
    counts.set(key, (counts.get(key) ?? 0) + bucket.count)
  }

  return Array.from({ length: 7 * 4 }, (_, index) => {
    const weekday = Math.floor(index / 4)
    const period = index % 4
    return { weekday, period, count: counts.get(`${weekday}-${period}`) ?? 0 }
  })
}

export function getBusiestWeekday(activity: ActivityInsight[]): {
  weekday: number
  count: number
} | null {
  if (activity.length === 0) return null
  const totals = Array.from({ length: 7 }, () => 0)
  for (const bucket of activity) totals[bucket.weekday] += bucket.count
  const count = Math.max(...totals)
  return { weekday: totals.indexOf(count), count }
}

export function getBusiestHour(
  activity: ActivityInsight[]
): { hour: number; count: number } | null {
  if (activity.length === 0) return null
  const totals = Array.from({ length: 24 }, () => 0)
  for (const bucket of activity) totals[bucket.hour] += bucket.count
  const count = Math.max(...totals)
  return { hour: totals.indexOf(count), count }
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59`
}
