import type { Message } from '../models/types'
import {
  buildTimelineItems,
  formatDateLabel,
  mergeTimelineWindow,
  type TimelineRecord
} from '../utils/chat-timeline'
import { describe, expect, it } from 'vitest'
import { buildMessageInfoRows, getMessageActionAvailability } from '../utils/message-actions'

function record(sequence: number, timestamp: string, sender = 'Alice'): TimelineRecord {
  const message: Message = {
    id: `msg-${sequence}`,
    sender,
    text: `message ${sequence}`,
    mediaType: null,
    mediaUri: null,
    mediaFilename: null,
    mediaSize: null,
    mediaWidth: null,
    mediaHeight: null,
    mediaDuration: null,
    mediaPreviewUri: null,
    mediaWaveform: null,
    timestamp: new Date(timestamp),
    isEdited: false,
    isMine: false,
    isSystem: false
  }

  return { sequence, message }
}

function imageRecord(
  sequence: number,
  timestamp: string,
  sender = 'Alice',
  overrides: Partial<Message> = {}
): TimelineRecord {
  return {
    sequence,
    message: {
      ...record(sequence, timestamp, sender).message,
      text: null,
      mediaType: 'image',
      mediaUri: `file:///${sequence}.jpg`,
      mediaFilename: `${sequence}.jpg`,
      mediaPreviewUri: `file:///preview-${sequence}.jpg`,
      mediaWidth: 1200,
      mediaHeight: 1600,
      ...overrides
    }
  }
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
    expect(items.filter(item => item.type === 'message').map(item => item.sequence)).toEqual([
      1, 2, 3, 4
    ])
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

  it('collapses consecutive images from one sender into a stable gallery item', () => {
    const items = buildTimelineItems([
      record(1, '2026-08-22T08:00:00'),
      imageRecord(2, '2026-08-22T08:01:00'),
      imageRecord(3, '2026-08-22T08:01:10'),
      imageRecord(4, '2026-08-22T08:01:20'),
      imageRecord(5, '2026-08-22T08:01:30'),
      imageRecord(6, '2026-08-22T08:01:40'),
      record(7, '2026-08-22T08:02:00')
    ])

    const gallery = items.find(item => item.type === 'image-group')
    expect(gallery).toMatchObject({
      id: 'image-group-2-6',
      firstSequence: 2,
      lastSequence: 6,
      showSender: false
    })
    expect(
      gallery?.type === 'image-group' ? gallery.records.map(item => item.sequence) : []
    ).toEqual([2, 3, 4, 5, 6])
  })

  it('does not swallow captions, stickers, sender changes, or distant images into a gallery', () => {
    const items = buildTimelineItems([
      imageRecord(1, '2026-08-22T08:00:00'),
      imageRecord(2, '2026-08-22T08:00:10', 'Alice', { text: 'Keep this caption' }),
      imageRecord(3, '2026-08-22T08:00:20', 'Alice', {
        mediaFilename: 'STK-123.webp',
        mediaUri: 'file:///STK-123.webp'
      }),
      imageRecord(4, '2026-08-22T08:00:30', 'Bob'),
      imageRecord(5, '2026-08-22T08:04:00', 'Bob')
    ])

    expect(items.some(item => item.type === 'image-group')).toBe(false)
    expect(items.filter(item => item.type === 'message')).toHaveLength(5)
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

describe('message actions', () => {
  it('only exposes text and bookmark actions when the message supports them', () => {
    const textMessage = record(1, '2026-08-22T08:00:00').message
    const systemMessage = {
      ...record(2, '2026-08-22T08:01:00').message,
      text: null,
      isSystem: true
    }

    expect(getMessageActionAvailability(textMessage)).toEqual({
      copy: true,
      share: true,
      bookmark: true,
      information: true
    })
    expect(getMessageActionAvailability(systemMessage)).toEqual({
      copy: false,
      share: false,
      bookmark: false,
      information: true
    })
  })

  it('formats available file metadata for the information view', () => {
    const message = {
      ...record(3, '2026-08-22T08:02:00').message,
      mediaType: 'audio' as const,
      mediaUri: 'file:///voice.opus',
      mediaFilename: 'voice.opus',
      mediaSize: 2_048,
      mediaDuration: 61.8,
      isEdited: true
    }

    expect(buildMessageInfoRows(message, () => '22 Aug 2026, 08:02')).toEqual(
      expect.arrayContaining([
        { label: 'Timestamp', value: '22 Aug 2026, 08:02' },
        { label: 'Edited', value: 'Yes' },
        { label: 'Filename', value: 'voice.opus' },
        { label: 'Size', value: '2.0 KB' },
        { label: 'Duration', value: '1:01' },
        { label: 'File', value: 'Available' }
      ])
    )
  })
})
