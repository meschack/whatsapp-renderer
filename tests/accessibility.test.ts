import { describe, expect, it } from 'vitest'
import type { Message } from '../models/types'
import { getMessageAccessibilityLabel, shouldPerformHapticFeedback } from '../utils/accessibility'

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    sender: 'Alice',
    text: 'Hello there',
    mediaType: null,
    mediaUri: null,
    mediaFilename: null,
    mediaSize: null,
    mediaWidth: null,
    mediaHeight: null,
    mediaDuration: null,
    mediaPreviewUri: null,
    mediaWaveform: null,
    timestamp: new Date('2026-08-23T10:30:00'),
    isEdited: false,
    isMine: false,
    isSystem: false,
    ...overrides
  }
}

describe('accessibility presentation', () => {
  it('describes message ownership, content, media, edit state, and time', () => {
    expect(getMessageAccessibilityLabel(message())).toContain('Alice. Hello there.')
    expect(
      getMessageAccessibilityLabel(
        message({ isMine: true, sender: 'Me', text: null, mediaType: 'audio', isEdited: true })
      )
    ).toMatch(/^You\. Voice message\. Edited\. /)
  })

  it('allows haptics only for explicit interactions when enabled', () => {
    expect(shouldPerformHapticFeedback(true, 'selection')).toBe(true)
    expect(shouldPerformHapticFeedback(true, 'action')).toBe(true)
    expect(shouldPerformHapticFeedback(true, 'scroll')).toBe(false)
    expect(shouldPerformHapticFeedback(false, 'action')).toBe(false)
  })
})
