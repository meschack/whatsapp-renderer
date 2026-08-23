import type { Message } from '../models/types'
import {
  buildTimelineItems,
  formatDateLabel,
  mergeTimelineWindow,
  type TimelineRecord
} from '../utils/chat-timeline'
import { describe, expect, it } from 'vitest'

function record(sequence: number, timestamp: string, sender = 'Alice'): TimelineRecord {
  const message: Message = {
    id: `msg-${sequence}`,
    sender,
    text: `message ${sequence}`,
    mediaType: null,
    mediaUri: null,
    timestamp: new Date(timestamp),
    isEdited: false,
    isMine: false,
    isSystem: false
  }

  return { sequence, message }
}

describe('buildTimelineItems', () => {
  it('produces chronological items with exactly one unique separator per day', () => {
    const records = [
      record(1, '2026-08-21T09:00:00'),
      record(2, '2026-08-21T10:00:00'),
      record(3, '2026-08-22T08:00:00'),
      record(4, '2026-08-22T09:00:00')
    ]

    const items = buildTimelineItems(records, new Date('2026-08-23T12:00:00'))
    const ids = items.map(item => item.id)

    expect(ids).toEqual(['date-2026-08-21', 'msg-1', 'msg-2', 'date-2026-08-22', 'msg-3', 'msg-4'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('recomputes sender grouping across page boundaries', () => {
    const items = buildTimelineItems([
      record(48, '2026-08-22T08:00:00', 'Alice'),
      record(49, '2026-08-22T08:01:00', 'Alice'),
      record(50, '2026-08-22T08:02:00', 'Bob')
    ])
    const messages = items.filter(item => item.type === 'message')

    expect(messages.map(item => item.showSender)).toEqual([true, false, true])
  })
})

describe('formatDateLabel', () => {
  const now = new Date('2026-08-23T12:00:00')

  it('uses compact WhatsApp-style labels outside today and yesterday', () => {
    expect(formatDateLabel(new Date('2026-08-11T08:00:00'), now)).toBe('Tue, 11 Aug')
    expect(formatDateLabel(new Date('2025-08-11T08:00:00'), now)).toBe('Mon, 11 Aug 2025')
  })

  it('keeps relative labels for the two days users scan most often', () => {
    expect(formatDateLabel(new Date('2026-08-23T08:00:00'), now)).toBe('Today')
    expect(formatDateLabel(new Date('2026-08-22T08:00:00'), now)).toBe('Yesterday')
  })
})

describe('mergeTimelineWindow', () => {
  it('deduplicates, sorts, and trims newer records after loading older history', () => {
    const current = Array.from({ length: 6 }, (_, index) =>
      record(index + 5, `2026-08-22T08:${String(index + 5).padStart(2, '0')}:00`)
    )
    const older = Array.from({ length: 5 }, (_, index) =>
      record(index + 1, `2026-08-22T08:${String(index + 1).padStart(2, '0')}:00`)
    )

    const result = mergeTimelineWindow(current, [...older, current[0]], 'older', 8)

    expect(result.records.map(item => item.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(result.trimmedOlder).toBe(false)
    expect(result.trimmedNewer).toBe(true)
  })

  it('trims older records after loading newer history', () => {
    const current = Array.from({ length: 6 }, (_, index) =>
      record(index + 1, `2026-08-22T08:${String(index + 1).padStart(2, '0')}:00`)
    )
    const newer = Array.from({ length: 5 }, (_, index) =>
      record(index + 7, `2026-08-22T08:${String(index + 7).padStart(2, '0')}:00`)
    )

    const result = mergeTimelineWindow(current, newer, 'newer', 8)

    expect(result.records.map(item => item.sequence)).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(result.trimmedOlder).toBe(true)
    expect(result.trimmedNewer).toBe(false)
  })
})
