import { describe, expect, it } from 'vitest'

import { selectTimelineBudget } from '../utils/timeline-budget'

const MEBIBYTE = 1024 * 1024

describe('selectTimelineBudget', () => {
  it('halves page bursts and the retained window on a constrained-memory phone', () => {
    expect(
      selectTimelineBudget({
        totalMemoryBytes: 1877736 * 1024,
        maxMemoryBytes: 256 * MEBIBYTE
      })
    ).toEqual({
      tier: 'constrained',
      pageSize: 50,
      maxMessages: 300
    })
  })

  it('keeps the proven larger window when both memory signals have ample headroom', () => {
    expect(
      selectTimelineBudget({
        totalMemoryBytes: 8 * 1024 ** 3,
        maxMemoryBytes: 768 * MEBIBYTE
      })
    ).toEqual({
      tier: 'roomy',
      pageSize: 100,
      maxMessages: 600
    })
  })

  it('uses the balanced budget until the per-app memory ceiling is known', () => {
    expect(
      selectTimelineBudget({
        totalMemoryBytes: 8 * 1024 ** 3,
        maxMemoryBytes: null
      })
    ).toEqual({
      tier: 'balanced',
      pageSize: 75,
      maxMessages: 450
    })
  })

  it('lets a small per-app ceiling override otherwise roomy physical memory', () => {
    expect(
      selectTimelineBudget({
        totalMemoryBytes: 8 * 1024 ** 3,
        maxMemoryBytes: 128 * MEBIBYTE
      })
    ).toEqual({
      tier: 'constrained',
      pageSize: 50,
      maxMessages: 300
    })
  })
})
