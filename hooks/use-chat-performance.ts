import { useBenchmark, type BenchmarkResult, type FlashListRef } from '@shopify/flash-list'
import { useCallback, useEffect, useRef } from 'react'

import type { TimelineDeviceProfile } from '@/hooks/use-timeline-budget'
import { summarizeFrameDurations } from '@/utils/chat-performance'
import type { TimelineBudget } from '@/utils/timeline-budget'

interface PageLoadEvent {
  direction: 'initial' | 'older' | 'newer'
  durationMs: number
}

interface ChatPerformanceMetrics {
  initialRenderMs: number | null
  pageLoads: PageLoadEvent[]
}

interface ChatPerformanceContext {
  budget: TimelineBudget
  device: TimelineDeviceProfile
}

export const CHAT_BENCHMARK_ENABLED = process.env.EXPO_PUBLIC_CHAT_BENCHMARK === '1'

export function useChatPerformance(
  listRef: React.RefObject<FlashListRef<any> | null>,
  context: ChatPerformanceContext
) {
  const metricsRef = useRef<ChatPerformanceMetrics>({
    initialRenderMs: null,
    pageLoads: []
  })
  const frameDurationsRef = useRef<number[]>([])
  const lastFrameAtRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const onPageLoad = useCallback((event: PageLoadEvent) => {
    const pageLoads = metricsRef.current.pageLoads
    pageLoads.push(event)
    if (pageLoads.length > 20) pageLoads.shift()
  }, [])

  const onLoad = useCallback(({ elapsedTimeInMs }: { elapsedTimeInMs: number }) => {
    metricsRef.current.initialRenderMs = elapsedTimeInMs
  }, [])

  const stopFrameSampling = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    lastFrameAtRef.current = null
  }, [])

  const handleBenchmark = useCallback(
    (result: BenchmarkResult) => {
      stopFrameSampling()
      if (!CHAT_BENCHMARK_ENABLED || result.interrupted) return

      console.info(
        '[CHAT_PERF]',
        JSON.stringify({
          device: context.device,
          timelineBudget: context.budget,
          jsFps: result.js,
          jsJank: summarizeFrameDurations(frameDurationsRef.current),
          suggestions: result.suggestions,
          ...metricsRef.current
        })
      )
    },
    [context.budget, context.device, stopFrameSampling]
  )

  // FlashList's runtime accepts an initially-null ref, though 2.3.0's public type omits null.
  const { startBenchmark: runBenchmark, isBenchmarkRunning } = useBenchmark(
    listRef as React.RefObject<FlashListRef<any>>,
    handleBenchmark,
    {
      startManually: true,
      repeatCount: 3,
      speedMultiplier: 1.5
    }
  )

  const startBenchmark = useCallback(() => {
    frameDurationsRef.current = []
    lastFrameAtRef.current = null

    const sampleFrame = (now: number) => {
      const previous = lastFrameAtRef.current
      if (previous !== null) frameDurationsRef.current.push(now - previous)
      lastFrameAtRef.current = now
      animationFrameRef.current = requestAnimationFrame(sampleFrame)
    }

    animationFrameRef.current = requestAnimationFrame(sampleFrame)
    try {
      runBenchmark()
    } catch (error) {
      stopFrameSampling()
      throw error
    }
  }, [runBenchmark, stopFrameSampling])

  useEffect(
    () => () => {
      stopFrameSampling()
    },
    [stopFrameSampling]
  )

  return {
    isBenchmarkRunning,
    startBenchmark,
    onPageLoad,
    onLoad,
    benchmarkEnabled: CHAT_BENCHMARK_ENABLED
  }
}
