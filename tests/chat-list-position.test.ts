import {
  findPendingMessageJumpIndex,
  MAINTAIN_BOTTOM_POSITION,
  MAINTAIN_RESTORED_POSITION,
  shouldShowVisibleDate
} from '../utils/chat-list-position'
import type { TimelineItem } from '../utils/chat-timeline'
import { describe, expect, it } from 'vitest'

describe('chat list position policy', () => {
  it('starts an ordinary chat at the newest messages without auto-jumping across appended pages', () => {
    expect(MAINTAIN_BOTTOM_POSITION).toEqual({
      startRenderingFromBottom: true
    })
  })

  it('keeps a restored chat anchored without auto-jumping across appended pages', () => {
    expect(MAINTAIN_RESTORED_POSITION).toEqual({
      startRenderingFromBottom: false
    })
  })

  it('keeps the current visible message date present whenever a date is known', () => {
    expect(shouldShowVisibleDate('Today')).toBe(true)
    expect(shouldShowVisibleDate(null)).toBe(false)
  })

  it('resolves an explicit jump only after the requested page is restored', () => {
    const items = [
      { type: 'date', id: 'date-1', date: 'Today' },
      { type: 'message', id: 'msg-104', sequence: 104, message: {}, showSender: false },
      {
        type: 'image-group',
        id: 'image-group-105-107',
        firstSequence: 105,
        lastSequence: 107,
        records: [],
        showSender: false
      }
    ] as TimelineItem[]

    expect(findPendingMessageJumpIndex(items, 106, 104)).toBeNull()
    expect(findPendingMessageJumpIndex(items, 106, 106)).toBe(2)
    expect(findPendingMessageJumpIndex(items, 104, 104)).toBe(1)
  })
})
