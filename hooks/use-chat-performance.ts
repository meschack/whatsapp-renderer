import {
  useBenchmark,
  type BenchmarkResult,
  type FlashListRef
} from '@shopify/flash-list'
import { useCallback, useRef } from 'react'

interface PageLoadEvent {
  direction: 'initial' | 'older' | 'newer'
  durationMs: number
}

interface ChatPerformanceMetrics {
  initialRenderMs: number | null
  pageLoads: PageLoadEvent[]
}

export const CHAT_BENCHMARK_ENABLED = process.env.EXPO_PUBLIC_CHAT_BENCHMARK === '1'

export function useChatPerformance(listRef: React.RefObject<FlashListRef<any> | null>) {
  const metricsRef = useRef<ChatPerformanceMetrics>({
    initialRenderMs: null,
    pageLoads: []
  })

  const onPageLoad = useCallback((event: PageLoadEvent) => {
    const pageLoads = metricsRef.current.pageLoads
    pageLoads.push(event)
    if (pageLoads.length > 20) pageLoads.shift()
  }, [])

  const onLoad = useCallback(({ elapsedTimeInMs }: { elapsedTimeInMs: number }) => {
    metricsRef.current.initialRenderMs = elapsedTimeInMs
  }, [])

  const handleBenchmark = useCallback((result: BenchmarkResult) => {
    if (!CHAT_BENCHMARK_ENABLED || result.interrupted) return

    console.info(
      '[CHAT_PERF]',
      JSON.stringify({
        jsFps: result.js,
        suggestions: result.suggestions,
        ...metricsRef.current
      })
    )
  }, [])

  // FlashList's runtime accepts an initially-null ref, though 2.3.0's public type omits null.
  const benchmark = useBenchmark(listRef as React.RefObject<FlashListRef<any>>, handleBenchmark, {
    startManually: true,
    repeatCount: 3,
    speedMultiplier: 1.5
  })

  return { onPageLoad, onLoad, benchmarkEnabled: CHAT_BENCHMARK_ENABLED, ...benchmark }
}
