export interface FrameJankSummary {
  sampledFrames: number
  slowFrames: number
  frozenFrames: number
  worstFrameMs: number
}

const SLOW_FRAME_MS = 32
const FROZEN_FRAME_MS = 700

export function summarizeFrameDurations(frameDurations: number[]): FrameJankSummary {
  let slowFrames = 0
  let frozenFrames = 0
  let worstFrameMs = 0

  for (const duration of frameDurations) {
    if (duration > SLOW_FRAME_MS) slowFrames += 1
    if (duration > FROZEN_FRAME_MS) frozenFrames += 1
    worstFrameMs = Math.max(worstFrameMs, duration)
  }

  return {
    sampledFrames: frameDurations.length,
    slowFrames,
    frozenFrames,
    worstFrameMs: Math.round(worstFrameMs)
  }
}
