import type { Message } from '../models/types'
import { canJoinImageGroup, isGalleryImageMessage } from './image-gallery'

export interface TimelineRecord {
  sequence: number
  message: Message
}

export type TimelineItem =
  | { type: 'date'; id: string; date: string }
  | {
      type: 'image-group'
      id: string
      firstSequence: number
      lastSequence: number
      records: TimelineRecord[]
      showSender: boolean
    }
  | {
      type: 'message'
      id: string
      sequence: number
      message: Message
      showSender: boolean
    }

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

  for (let index = 0; index < records.length; index += 1) {
    const { sequence, message } = records[index]
    const day = localDayKey(message.timestamp)
    const startsDay = day !== previousDay

    if (startsDay) {
      items.push({
        type: 'date',
        id: `date-${day}`,
        date: formatDateLabel(message.timestamp, now)
      })
    }

    const showSender =
      !message.isSystem &&
      message.sender !== null &&
      (startsDay || previousMessage?.sender !== message.sender)

    if (isGalleryImageMessage(message)) {
      const group = [records[index]]
      while (index + group.length < records.length) {
        const candidate = records[index + group.length]
        const previous = group[group.length - 1]
        if (localDayKey(candidate.message.timestamp) !== day) break
        if (!canJoinImageGroup(previous.message, candidate.message)) break
        group.push(candidate)
      }

      if (group.length > 1) {
        const last = group[group.length - 1]
        items.push({
          type: 'image-group',
          id: `image-group-${sequence}-${last.sequence}`,
          firstSequence: sequence,
          lastSequence: last.sequence,
          records: group,
          showSender
        })
        previousMessage = last.message
        previousDay = day
        index += group.length - 1
        continue
      }
    }

    items.push({ type: 'message', id: message.id, sequence, message, showSender })

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
