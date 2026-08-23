export const HIGHLIGHT_START = '\u0001'
export const HIGHLIGHT_END = '\u0002'

export interface HighlightedExcerptSegment {
  text: string
  highlighted: boolean
}

/** Turn untrusted user text into a literal prefix query instead of FTS syntax. */
export function buildSearchExpression(query: string): string | null {
  const terms = query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu) ?? []

  if (terms.length === 0) return null
  return terms.map(term => `"${term}"*`).join(' AND ')
}

export function parseHighlightedExcerpt(excerpt: string): HighlightedExcerptSegment[] {
  const segments: HighlightedExcerptSegment[] = []
  let highlighted = false
  let cursor = 0

  while (cursor < excerpt.length) {
    const marker = highlighted ? HIGHLIGHT_END : HIGHLIGHT_START
    const markerIndex = excerpt.indexOf(marker, cursor)
    const end = markerIndex === -1 ? excerpt.length : markerIndex
    if (end > cursor) segments.push({ text: excerpt.slice(cursor, end), highlighted })
    if (markerIndex === -1) break
    highlighted = !highlighted
    cursor = markerIndex + marker.length
  }

  return segments
}
