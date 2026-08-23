import type { Message } from '../models/types'

export interface BookmarkCursor {
  createdAt: number
  messageSequence: number
}

export interface BookmarkRecord {
  sequence: number
  messageId: string
  sender: string | null
  timestamp: Date
  excerpt: string
  mediaType: Message['mediaType']
  createdAt: number
}

export interface BookmarkPage {
  records: BookmarkRecord[]
  hasMore: boolean
  nextCursor: BookmarkCursor | null
}
