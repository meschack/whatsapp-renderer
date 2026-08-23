export interface ChatDay {
  dayKey: string
  messageCount: number
}

export interface ChatDateTarget {
  dayKey: string
  sequence: number
  messageId: string
}

export interface CalendarDayCell {
  dayKey: string
  dayOfMonth: number
}

export function parseLocalDayKey(dayKey: string): Date | null {
  const match = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day)

  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day
    ? date
    : null
}

export function getLocalDayBounds(dayKey: string): { start: number; end: number } | null {
  const startDate = parseLocalDayKey(dayKey)
  if (!startDate) return null

  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1)
  return { start: startDate.getTime(), end: endDate.getTime() }
}

export function formatLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthIndexForDay(dayKey: string): number | null {
  const date = parseLocalDayKey(dayKey)
  return date ? date.getFullYear() * 12 + date.getMonth() : null
}

export function buildCalendarMonth(monthIndex: number): Array<CalendarDayCell | null> {
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex % 12
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<CalendarDayCell | null> = Array.from({ length: first.getDay() }, () => null)

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    cells.push({ dayKey: formatLocalDayKey(date), dayOfMonth: day })
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatCalendarMonth(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex % 12
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1)
  )
}

export function formatChatDateRange(firstDayKey: string, lastDayKey: string): string {
  const first = parseLocalDayKey(firstDayKey)
  const last = parseLocalDayKey(lastDayKey)
  if (!first || !last) return ''

  const formatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  return `${formatter.format(first)} – ${formatter.format(last)}`
}
