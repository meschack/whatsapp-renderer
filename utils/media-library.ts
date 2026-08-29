import type { MediaType } from '../models/types'

export type AttachmentFilter = MediaType | 'link'

export interface AttachmentRecord {
  sequence: number
  messageId: string
  type: AttachmentFilter
  sender: string | null
  timestamp: Date
  text: string | null
  mediaUri: string | null
  previewUri: string | null
  filename: string | null
  size: number | null
  width: number | null
  height: number | null
  duration: number | null
  url: string | null
}

export interface AttachmentPage {
  records: AttachmentRecord[]
  hasMore: boolean
}

export interface InitialAttachmentPage {
  records: AttachmentRecord[]
  hasOlder: boolean
  hasNewer: boolean
  restoredSequence: number | null
}

export interface AttachmentMergeResult {
  records: AttachmentRecord[]
  trimmedNewer: boolean
  trimmedOlder: boolean
}

/** Keep one descending, deduplicated attachment window and trim away from movement. */
export function mergeAttachmentWindow(
  current: AttachmentRecord[],
  incoming: AttachmentRecord[],
  direction: 'older' | 'newer',
  maxRecords: number
): AttachmentMergeResult {
  const bySequence = new Map<number, AttachmentRecord>()
  for (const record of current) bySequence.set(record.sequence, record)
  for (const record of incoming) bySequence.set(record.sequence, record)

  const merged = [...bySequence.values()].sort((a, b) => b.sequence - a.sequence)
  const overflow = Math.max(0, merged.length - maxRecords)
  if (overflow === 0) return { records: merged, trimmedNewer: false, trimmedOlder: false }

  if (direction === 'older') {
    return {
      records: merged.slice(overflow),
      trimmedNewer: true,
      trimmedOlder: false
    }
  }

  return {
    records: merged.slice(0, merged.length - overflow),
    trimmedNewer: false,
    trimmedOlder: true
  }
}
