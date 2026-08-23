import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  buildCalendarMonth,
  formatLocalDayKey,
  getLocalDayBounds,
  monthIndexForDay,
  parseLocalDayKey
} from '../utils/chat-calendar'

describe('chat calendar local-day calculations', () => {
  const originalTimezone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  })

  it('uses calendar midnights across daylight-saving transitions', () => {
    const spring = getLocalDayBounds('2026-03-08')
    const autumn = getLocalDayBounds('2026-11-01')

    expect(spring).not.toBeNull()
    expect(autumn).not.toBeNull()
    expect(spring!.end - spring!.start).toBe(23 * 60 * 60 * 1_000)
    expect(autumn!.end - autumn!.start).toBe(25 * 60 * 60 * 1_000)
    expect(formatLocalDayKey(new Date(spring!.start))).toBe('2026-03-08')
    expect(formatLocalDayKey(new Date(spring!.end))).toBe('2026-03-09')
  })

  it('builds complete month rows and rejects impossible day keys', () => {
    const february = buildCalendarMonth(monthIndexForDay('2026-02-01')!)
    const actualDays = february.filter(cell => cell !== null)

    expect(february).toHaveLength(28)
    expect(actualDays).toHaveLength(28)
    expect(actualDays[0]).toEqual({ dayKey: '2026-02-01', dayOfMonth: 1 })
    expect(actualDays.at(-1)).toEqual({ dayKey: '2026-02-28', dayOfMonth: 28 })
    expect(parseLocalDayKey('2026-02-29')).toBeNull()
    expect(parseLocalDayKey('whatever')).toBeNull()
  })
})
