import { useCallback, useEffect, useRef, useState } from 'react'

import { getNewerAttachmentPage, getOlderAttachmentPage } from '@/store/message-database'
import {
  mergeAttachmentWindow,
  type AttachmentFilter,
  type AttachmentPage,
  type AttachmentRecord
} from '@/utils/media-library'

const DEFAULT_PAGE_SIZE = 45
const DEFAULT_MAX_RECORDS = 180

interface AttachmentRepository {
  older(
    chatId: string,
    filter: AttachmentFilter,
    beforeSequence: number | null,
    limit: number
  ): Promise<AttachmentPage>
  newer(
    chatId: string,
    filter: AttachmentFilter,
    afterSequence: number,
    limit: number
  ): Promise<AttachmentPage>
}

const defaultRepository: AttachmentRepository = {
  older: getOlderAttachmentPage,
  newer: getNewerAttachmentPage
}

interface AttachmentPagesOptions {
  pageSize?: number
  maxRecords?: number
  repository?: AttachmentRepository
}

export function useAttachmentPages(
  chatId: string,
  filter: AttachmentFilter,
  options: AttachmentPagesOptions = {}
) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS
  const repository = options.repository ?? defaultRepository
  const requestKey = `${chatId}\u0000${filter}`
  const [activeKey, setActiveKey] = useState(requestKey)
  const [records, setRecords] = useState<AttachmentRecord[]>([])
  const [hasOlder, setHasOlder] = useState(false)
  const [hasNewer, setHasNewer] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [isLoadingNewer, setIsLoadingNewer] = useState(false)
  const recordsRef = useRef<AttachmentRecord[]>([])
  const hasOlderRef = useRef(false)
  const hasNewerRef = useRef(false)
  const generationRef = useRef(0)
  const inFlightRef = useRef({ older: false, newer: false })

  const replaceRecords = useCallback((next: AttachmentRecord[]) => {
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
    setActiveKey(requestKey)
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
    void repository.older(chatId, filter, null, pageSize).then(
      page => {
        if (generationRef.current !== generation) return
        replaceRecords(page.records)
        replaceHasOlder(page.hasMore)
        replaceHasNewer(false)
        setIsInitialLoading(false)
      },
      error => {
        if (generationRef.current !== generation) return
        console.error('Failed to load attachments', error)
        setIsInitialLoading(false)
      }
    )

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
    }
  }, [
    chatId,
    filter,
    pageSize,
    repository,
    replaceHasNewer,
    replaceHasOlder,
    replaceRecords,
    requestKey
  ])

  const loadOlder = useCallback(async () => {
    if (!hasOlderRef.current || inFlightRef.current.older) return
    const cursor = recordsRef.current.at(-1)?.sequence
    if (cursor === undefined) return

    inFlightRef.current.older = true
    setIsLoadingOlder(true)
    const generation = generationRef.current
    try {
      const page = await repository.older(chatId, filter, cursor, pageSize)
      if (generationRef.current !== generation || recordsRef.current.at(-1)?.sequence !== cursor) {
        return
      }
      const merged = mergeAttachmentWindow(recordsRef.current, page.records, 'older', maxRecords)
      replaceRecords(merged.records)
      replaceHasOlder(page.hasMore)
      if (merged.trimmedNewer) replaceHasNewer(true)
    } catch (error) {
      console.error('Failed to load older attachments', error)
    } finally {
      if (generationRef.current === generation) {
        inFlightRef.current.older = false
        setIsLoadingOlder(false)
      }
    }
  }, [
    chatId,
    filter,
    maxRecords,
    pageSize,
    repository,
    replaceHasNewer,
    replaceHasOlder,
    replaceRecords
  ])

  const loadNewer = useCallback(async () => {
    if (!hasNewerRef.current || inFlightRef.current.newer) return
    const cursor = recordsRef.current[0]?.sequence
    if (cursor === undefined) return

    inFlightRef.current.newer = true
    setIsLoadingNewer(true)
    const generation = generationRef.current
    try {
      const page = await repository.newer(chatId, filter, cursor, pageSize)
      if (generationRef.current !== generation || recordsRef.current[0]?.sequence !== cursor) return
      const merged = mergeAttachmentWindow(recordsRef.current, page.records, 'newer', maxRecords)
      replaceRecords(merged.records)
      replaceHasNewer(page.hasMore)
      if (merged.trimmedOlder) replaceHasOlder(true)
    } catch (error) {
      console.error('Failed to load newer attachments', error)
    } finally {
      if (generationRef.current === generation) {
        inFlightRef.current.newer = false
        setIsLoadingNewer(false)
      }
    }
  }, [
    chatId,
    filter,
    maxRecords,
    pageSize,
    repository,
    replaceHasNewer,
    replaceHasOlder,
    replaceRecords
  ])

  const isStale = activeKey !== requestKey
  return {
    records: isStale ? [] : records,
    hasOlder: isStale ? false : hasOlder,
    hasNewer: isStale ? false : hasNewer,
    isInitialLoading: isStale || isInitialLoading,
    isLoadingOlder,
    isLoadingNewer,
    loadOlder,
    loadNewer
  }
}
