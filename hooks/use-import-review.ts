import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatImportPreview, ChatImportReviewDecision } from '@/utils/chat-import-workflow'

export function useImportReview() {
  const [preview, setPreview] = useState<ChatImportPreview | null>(null)
  const pending = useRef<((accepted: ChatImportReviewDecision) => void) | null>(null)
  const respond = useCallback(
    (accepted: ChatImportReviewDecision) => pending.current?.(accepted),
    []
  )
  const requestReview = useCallback((next: ChatImportPreview, signal?: AbortSignal) => {
    pending.current?.(false)
    if (signal?.aborted) return Promise.resolve(false)
    return new Promise<ChatImportReviewDecision>(resolve => {
      const abort = () => finish(false)
      const finish = (accepted: ChatImportReviewDecision) => {
        signal?.removeEventListener('abort', abort)
        pending.current = null
        setPreview(null)
        resolve(accepted)
      }
      pending.current = finish
      signal?.addEventListener('abort', abort, { once: true })
      setPreview(next)
      if (signal?.aborted) finish(false)
    })
  }, [])
  useEffect(() => () => pending.current?.(false), [])
  return { preview, requestReview, respond }
}
