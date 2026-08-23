import type { Message } from '../models/types'

export interface TimelineRecord {
  sequence: number
  message: Message
}

export type TimelineItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; id: string; message: Message; showSender: boolean }

export type LoadDirection = 'older' | 'newer'

export interface TimelineMergeResult {
  records: TimelineRecord[]
  trimmedOlder: boolean
  trimmedNewer: boolean
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateLabel(date: Date, now = new Date()): string {
  const today = localDayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (localDayKey(date) === today) return 'Today'
  if (localDayKey(date) === localDayKey(yesterday)) return 'Yesterday'

  const includesYear = date.getFullYear() !== now.getFullYear()
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const month = date.toLocaleDateString('en-GB', { month: 'short' })
  const year = includesYear ? ` ${date.getFullYear()}` : ''
  return `${weekday}, ${date.getDate()} ${month}${year}`
}

/** Build all presentation-only timeline items from one bounded chronological window. */
export function buildTimelineItems(records: TimelineRecord[], now = new Date()): TimelineItem[] {
  const items: TimelineItem[] = []
  let previousMessage: Message | null = null
  let previousDay: string | null = null

  for (const { message } of records) {
    const day = localDayKey(message.timestamp)
    const startsDay = day !== previousDay

    if (startsDay) {
      items.push({
        type: 'date',
        id: `date-${day}`,
        date: formatDateLabel(message.timestamp, now)
      })
    }

    items.push({
      type: 'message',
      id: message.id,
      message,
      showSender:
        !message.isSystem &&
        message.sender !== null &&
        (startsDay || previousMessage?.sender !== message.sender)
    })

    previousMessage = message
    previousDay = day
  }

  return items
}

/** Merge a page and cap memory by trimming the edge opposite the user's movement. */
export function mergeTimelineWindow(
  current: TimelineRecord[],
  incoming: TimelineRecord[],
  direction: LoadDirection,
  maxRecords: number
): TimelineMergeResult {
  const bySequence = new Map<number, TimelineRecord>()

  for (const record of current) bySequence.set(record.sequence, record)
  for (const record of incoming) bySequence.set(record.sequence, record)

  const merged = Array.from(bySequence.values()).sort((a, b) => a.sequence - b.sequence)
  const overflow = Math.max(0, merged.length - maxRecords)

  if (overflow === 0) {
    return { records: merged, trimmedOlder: false, trimmedNewer: false }
  }

  if (direction === 'older') {
    return {
      records: merged.slice(0, merged.length - overflow),
      trimmedOlder: false,
      trimmedNewer: true
    }
  }

  return {
    records: merged.slice(overflow),
    trimmedOlder: true,
    trimmedNewer: false
  }
}
