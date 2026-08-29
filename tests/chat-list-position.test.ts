import { MAINTAIN_BOTTOM_POSITION, MAINTAIN_RESTORED_POSITION } from '../utils/chat-list-position'
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
})
