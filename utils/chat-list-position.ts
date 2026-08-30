import type { TimelineItem } from './chat-timeline'

export const MAINTAIN_BOTTOM_POSITION = {
  startRenderingFromBottom: true
} as const

export const MAINTAIN_RESTORED_POSITION = {
  ...MAINTAIN_BOTTOM_POSITION,
  startRenderingFromBottom: false
} as const

export function shouldShowVisibleDate(visibleDate: string | null): boolean {
  return visibleDate !== null
}

export function findTimelineMessageIndex(items: TimelineItem[], sequence: number): number | null {
  const index = items.findIndex(item => {
    if (item.type === 'message') return item.sequence === sequence
    if (item.type === 'image-group') {
      return sequence >= item.firstSequence && sequence <= item.lastSequence
    }
    return false
  })

  return index >= 0 ? index : null
}

export function findPendingMessageJumpIndex(
  items: TimelineItem[],
  requestedSequence: number,
  restoredSequence: number | null
): number | null {
  if (restoredSequence !== requestedSequence) return null
  return findTimelineMessageIndex(items, requestedSequence)
}
