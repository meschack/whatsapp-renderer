import { describe, expect, it } from 'vitest'

import { summarizeFrameDurations } from '../utils/chat-performance'

describe('summarizeFrameDurations', () => {
  it('reports slow and frozen JavaScript frames from a benchmark run', () => {
    expect(summarizeFrameDurations([16, 17, 40, 801])).toEqual({
      sampledFrames: 4,
      slowFrames: 2,
      frozenFrames: 1,
      worstFrameMs: 801
    })
  })
})
