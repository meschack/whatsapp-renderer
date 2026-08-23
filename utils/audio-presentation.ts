export const AUDIO_BAR_COUNT = 40
export const AUDIO_BAR_MIN_HEIGHT = 3
export const AUDIO_BAR_MAX_HEIGHT = 18

export function shouldShowPlaybackRate(state: { isActive: boolean; isPlaying: boolean }): boolean {
  return state.isActive && state.isPlaying
}

export function getVisualAudioProgress(state: {
  isActive: boolean
  isPlaying: boolean
  progress: number
}): number {
  if (!state.isActive || !state.isPlaying) return 0
  return clamp(state.progress, 0, 1)
}

export function getScrubberLeft(progress: number, trackWidth: number, radius: number): number {
  return clamp(progress, 0, 1) * trackWidth - radius
}

export function getRemainingPlaybackMs(
  progress: number,
  durationSeconds: number,
  playbackRate: number
): number {
  if (durationSeconds <= 0 || playbackRate <= 0) return 0
  return ((1 - clamp(progress, 0, 1)) * durationSeconds * 1000) / playbackRate
}

export function formatPlaybackRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate}x`
}

/**
 * Stretch ordinary speech across the available height range. A tiny deterministic
 * texture keeps near-flat samples legible without changing their overall envelope.
 */
export function normalizeWaveformBuckets(
  buckets: number[],
  minHeight = AUDIO_BAR_MIN_HEIGHT,
  maxHeight = AUDIO_BAR_MAX_HEIGHT
): number[] {
  const positive = buckets.filter(value => value > 0).sort((a, b) => a - b)
  if (positive.length === 0) return buckets.map(() => minHeight)

  const low = quantile(positive, 0.1)
  const high = quantile(positive, 0.9)
  const span = high - low

  return buckets.map((value, index) => {
    if (value <= 0) return minHeight

    const normalized = span > 0.000001 ? clamp((value - low) / span, 0, 1) : 0.48
    const shaped = Math.pow(0.08 + normalized * 0.92, 0.72)
    const texture = 0.79 + Math.sin(index * 2.17 + 0.4) * 0.14 + Math.sin(index * 0.73 + 1.1) * 0.07
    return Math.round(
      clamp(minHeight + shaped * (maxHeight - minHeight) * texture, minHeight, maxHeight)
    )
  })
}

function quantile(sorted: number[], position: number): number {
  const index = (sorted.length - 1) * position
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const mix = index - lower
  return sorted[lower] * (1 - mix) + sorted[upper] * mix
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
