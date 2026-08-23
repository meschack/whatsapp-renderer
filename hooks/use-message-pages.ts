import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getLatestMessagePage,
  getNewerMessagePage,
  getOlderMessagePage,
  type MessagePage
} from '@/store/message-database'
import {
  buildTimelineItems,
  mergeTimelineWindow,
  type TimelineItem,
  type TimelineRecord
} from '@/utils/chat-timeline'

export type ListItem = TimelineItem

const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MAX_MESSAGES = 600

interface MessageRepository {
  latest: (chatId: string, limit: number) => Promise<MessagePage>
  older: (chatId: string, beforeSequence: number, limit: number) => Promise<MessagePage>
  newer: (chatId: string, afterSequence: number, limit: number) => Promise<MessagePage>
}

const messageRepository: MessageRepository = {
  latest: getLatestMessagePage,
  older: getOlderMessagePage,
  newer: getNewerMessagePage
}

interface MessagePagesOptions {
  pageSize?: number
  maxMessages?: number
  repository?: MessageRepository
  onPageLoad?: (event: { direction: 'initial' | 'older' | 'newer'; durationMs: number }) => void
}

export function useMessagePages(chatId: string, options: MessagePagesOptions = {}) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES
  const repository = options.repository ?? messageRepository
  const onPageLoadRef = useRef(options.onPageLoad)
  onPageLoadRef.current = options.onPageLoad

  const [records, setRecords] = useState<TimelineRecord[]>([])
  const [hasOlder, setHasOlder] = useState(false)
  const [hasNewer, setHasNewer] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [isLoadingNewer, setIsLoadingNewer] = useState(false)

  const recordsRef = useRef<TimelineRecord[]>([])
  const hasOlderRef = useRef(false)
  const hasNewerRef = useRef(false)
  const generationRef = useRef(0)
  const inFlightRef = useRef({ older: false, newer: false })

  const replaceRecords = useCallback((next: TimelineRecord[]) => {
    recordsRef.current = next
    setRecords(next)
  }, [])

  const replaceHasOlder = useCallback((next: boolean) => {
    hasOlderRef.current = next
    setHasOlder(next)
  }, [])

  const replaceHasNewer = useCallback((next: boolean) => {
    hasNewerRef.current = next
    setHasNewer(next)
  }, [])

  useEffect(() => {
    const generation = ++generationRef.current
    recordsRef.current = []
    hasOlderRef.current = false
    hasNewerRef.current = false
    inFlightRef.current = { older: false, newer: false }
    setRecords([])
    setHasOlder(false)
    setHasNewer(false)
    setIsLoadingOlder(false)
    setIsLoadingNewer(false)

    if (!chatId) {
      setIsInitialLoading(false)
      return
    }

    setIsInitialLoading(true)
    const startedAt = performance.now()

    void repository.latest(chatId, pageSize).then(
      page => {
        if (generationRef.current !== generation) return
        replaceRecords(page.records)
        replaceHasOlder(page.hasMore)
        replaceHasNewer(false)
        onPageLoadRef.current?.({
          direction: 'initial',
          durationMs: performance.now() - startedAt
        })
        setIsInitialLoading(false)
      },
      error => {
        if (generationRef.current !== generation) return
        setIsInitialLoading(false)
        console.error('Failed to load the initial message page', error)
      }
    )

    return () => {
      if (generationRef.current === generation) generationRef.current++
    }
  }, [chatId, pageSize, repository, replaceHasNewer, replaceHasOlder, replaceRecords])

  const loadOlder = useCallback(async () => {
    if (!chatId || !hasOlderRef.current || inFlightRef.current.older) return
    const first = recordsRef.current[0]
    if (!first) return

    inFlightRef.current.older = true
    setIsLoadingOlder(true)
    const generation = generationRef.current
    const requestedCursor = first.sequence
    const startedAt = performance.now()

    try {
      const page = await repository.older(chatId, requestedCursor, pageSize)
      if (
        generationRef.current !== generation ||
        recordsRef.current[0]?.sequence !== requestedCursor
      ) {
        return
      }

      const merged = mergeTimelineWindow(
        recordsRef.current,
        page.records,
        'older',
        maxMessages
      )
      replaceRecords(merged.records)
      replaceHasOlder(page.hasMore)
      if (merged.trimmedNewer) replaceHasNewer(true)
      onPageLoadRef.current?.({
        direction: 'older',
        durationMs: performance.now() - startedAt
      })
    } catch (error) {
      console.error('Failed to load older messages', error)
    } finally {
      if (generationRef.current === generation) {
        inFlightRef.current.older = false
        setIsLoadingOlder(false)
      }
    }
  }, [chatId, maxMessages, pageSize, repository, replaceHasNewer, replaceHasOlder, replaceRecords])

  const loadNewer = useCallback(async () => {
    if (!chatId || !hasNewerRef.current || inFlightRef.current.newer) return
    const last = recordsRef.current[recordsRef.current.length - 1]
    if (!last) return

    inFlightRef.current.newer = true
    setIsLoadingNewer(true)
    const generation = generationRef.current
    const requestedCursor = last.sequence
    const startedAt = performance.now()

    try {
      const page = await repository.newer(chatId, requestedCursor, pageSize)
      if (
        generationRef.current !== generation ||
        recordsRef.current[recordsRef.current.length - 1]?.sequence !== requestedCursor
      ) {
        return
      }

      const merged = mergeTimelineWindow(
        recordsRef.current,
        page.records,
        'newer',
        maxMessages
      )
      replaceRecords(merged.records)
      replaceHasNewer(page.hasMore)
      if (merged.trimmedOlder) replaceHasOlder(true)
      onPageLoadRef.current?.({
        direction: 'newer',
        durationMs: performance.now() - startedAt
      })
    } catch (error) {
      console.error('Failed to load newer messages', error)
    } finally {
      if (generationRef.current === generation) {
        inFlightRef.current.newer = false
        setIsLoadingNewer(false)
      }
    }
  }, [chatId, maxMessages, pageSize, repository, replaceHasNewer, replaceHasOlder, replaceRecords])

  const items = useMemo(() => buildTimelineItems(records), [records])

  return {
    items,
    loadOlder,
    loadNewer,
    hasOlder,
    hasNewer,
    isInitialLoading,
    isLoadingOlder,
    isLoadingNewer
  }
}
