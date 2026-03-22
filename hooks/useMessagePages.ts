import { useState, useCallback, useEffect, useRef } from 'react'
import { getMessagePage } from '@/store/messageDatabase'
import type { Message } from '@/models/types'

export type ListItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; id: string; message: Message; showSender: boolean }

const PAGE_SIZE = 50

function formatDateLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Convert a page of messages (newest-first from SQL) into ListItems
 * with date separators and sender grouping.
 *
 * Since the list is inverted, "previous" in visual terms means newer messages.
 * lastMessageOfPrevPage is the last item currently in the list (the oldest message loaded so far).
 */
function buildPageItems(
  messages: Message[],
  lastMessageOfPrevPage: Message | null
): ListItem[] {
  const items: ListItem[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    // Determine the message that comes "after" this one chronologically
    // (i.e., the newer message, which is at index i-1 since we're newest-first)
    const newerMsg = i === 0 ? lastMessageOfPrevPage : messages[i - 1]

    // Insert date separator when the date changes between this message and the newer one
    // In an inverted list, date separators appear below the messages of that date
    const msgDateStr = msg.timestamp.toDateString()
    const newerDateStr = newerMsg?.timestamp.toDateString()

    if (newerDateStr && newerDateStr !== msgDateStr) {
      // The newer message has a different date, so we insert a separator for the newer date
      items.push({
        type: 'date',
        id: `date-${newerDateStr}`,
        date: formatDateLabel(newerMsg!.timestamp)
      })
    }

    // Determine if we should show the sender name
    // In the inverted list (newest first), the "next" message visually below is at i+1
    const olderMsg = i < messages.length - 1 ? messages[i + 1] : null
    const showSender = !msg.isSystem && msg.sender !== olderMsg?.sender

    items.push({
      type: 'message',
      id: msg.id,
      message: msg,
      showSender
    })
  }

  return items
}

export function useMessagePages(chatId: string, totalCount: number) {
  const [items, setItems] = useState<ListItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const offsetRef = useRef(0)
  const allMessagesRef = useRef<Message[]>([])
  const loadedRef = useRef(false)

  // Load first page on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const messages = getMessagePage(chatId, PAGE_SIZE, 0)
    allMessagesRef.current = messages
    offsetRef.current = messages.length
    setHasMore(messages.length < totalCount)

    // Build items — no previous page for the first load
    const pageItems = buildPageItems(messages, null)

    // Add date separator for the first (newest) message's date at the top
    if (messages.length > 0) {
      const firstDate = messages[0].timestamp
      pageItems.unshift({
        type: 'date',
        id: `date-${firstDate.toDateString()}`,
        date: formatDateLabel(firstDate)
      })
    }

    setItems(pageItems)
  }, [chatId, totalCount])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return

    setIsLoadingMore(true)

    const newMessages = getMessagePage(chatId, PAGE_SIZE, offsetRef.current)

    if (newMessages.length === 0) {
      setHasMore(false)
      setIsLoadingMore(false)
      return
    }

    const lastOfPrev = allMessagesRef.current[allMessagesRef.current.length - 1] ?? null
    allMessagesRef.current = [...allMessagesRef.current, ...newMessages]
    offsetRef.current += newMessages.length
    setHasMore(offsetRef.current < totalCount)

    const pageItems = buildPageItems(newMessages, lastOfPrev)

    // Add final date separator for the oldest message in this page
    // (only if it's the last page or the date differs from what comes next)
    if (newMessages.length > 0 && newMessages.length < PAGE_SIZE) {
      const oldestMsg = newMessages[newMessages.length - 1]
      pageItems.push({
        type: 'date',
        id: `date-${oldestMsg.timestamp.toDateString()}-end`,
        date: formatDateLabel(oldestMsg.timestamp)
      })
    }

    setItems(prev => [...prev, ...pageItems])
    setIsLoadingMore(false)
  }, [chatId, hasMore, isLoadingMore, totalCount])

  return { items, loadMore, hasMore, isLoadingMore }
}
