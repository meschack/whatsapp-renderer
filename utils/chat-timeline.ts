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

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short' })

export function formatDateLabel(date: Date, now = new Date()): string {
  const today = localDayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (localDayKey(date) === today) return 'Today'
  if (localDayKey(date) === localDayKey(yesterday)) return 'Yesterday'

  const includesYear = date.getFullYear() !== now.getFullYear()
  const weekday = weekdayFormatter.format(date)
  const month = monthFormatter.format(date)
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
          id: `image-group-${sequence}`,
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
  const chronological = (records: TimelineRecord[]) =>
    records.every((record, index) => index === 0 || records[index - 1].sequence <= record.sequence)
      ? records
      : [...records].sort((left, right) => left.sequence - right.sequence)
  const left = chronological(current)
  const right = chronological(incoming)
  const merged: TimelineRecord[] = []
  let i = 0
  let j = 0
  // Database pages are already ordered. Merge linearly and preserve row objects;
  // incoming copies win at overlap, without allocating a Map or sorting each page.
  while (i < left.length || j < right.length) {
    let next: TimelineRecord
    if (j >= right.length || (i < left.length && left[i].sequence < right[j].sequence))
      next = left[i++]
    else if (i >= left.length || right[j].sequence < left[i].sequence) next = right[j++]
    else {
      i++
      next = right[j++]
    }
    if (merged.at(-1)?.sequence === next.sequence) merged[merged.length - 1] = next
    else merged.push(next)
  }
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
