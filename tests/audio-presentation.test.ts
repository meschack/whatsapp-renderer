import {
  formatPlaybackRate,
  getNextPlaybackRate,
  getRemainingPlaybackMs,
  getScrubberLeft,
  getVisualAudioProgress,
  normalizeWaveformBuckets,
  shouldShowPlaybackRate
} from '../utils/audio-presentation'
import { describe, expect, it } from 'vitest'

describe('audio player presentation', () => {
  it('shows speed only while the active voice note is actually playing', () => {
    expect(shouldShowPlaybackRate({ isActive: false, isPlaying: false })).toBe(false)
    expect(shouldShowPlaybackRate({ isActive: true, isPlaying: false })).toBe(false)
    expect(shouldShowPlaybackRate({ isActive: true, isPlaying: true })).toBe(true)
  })

  it('formats the three WhatsApp playback rates compactly', () => {
    expect([1, 1.5, 2].map(formatPlaybackRate)).toEqual(['1x', '1.5x', '2x'])
  })

  it('cycles only through supported persistent playback rates', () => {
    expect(getNextPlaybackRate(1)).toBe(1.5)
    expect(getNextPlaybackRate(1.5)).toBe(2)
    expect(getNextPlaybackRate(2)).toBe(1)
    expect(getNextPlaybackRate(99)).toBe(1.5)
  })

  it('stretches speech dynamics without inventing activity in empty buckets', () => {
    const waveform = normalizeWaveformBuckets([0, 0.018, 0.021, 0.026, 0.08, 0.034, 0])

    expect(waveform[0]).toBe(3)
    expect(waveform.at(-1)).toBe(3)
    expect(Math.max(...waveform)).toBeLessThanOrEqual(18)
    expect(Math.max(...waveform) - Math.min(...waveform)).toBeGreaterThanOrEqual(12)
  })

  it('keeps a subtle visual pulse even when sampled speech is nearly flat', () => {
    const waveform = normalizeWaveformBuckets(new Array(40).fill(0.03))

    expect(new Set(waveform).size).toBeGreaterThanOrEqual(3)
  })

  it('resets visual progress whenever playback is not running', () => {
    expect(getVisualAudioProgress({ isActive: true, isPlaying: true, progress: 0.7 })).toBe(0.7)
    expect(getVisualAudioProgress({ isActive: true, isPlaying: false, progress: 0.7 })).toBe(0)
    expect(getVisualAudioProgress({ isActive: false, isPlaying: false, progress: 1 })).toBe(0)
  })

  it('places the scrubber center exactly on both ends of the track', () => {
    expect(getScrubberLeft(0, 180, 6)).toBe(-6)
    expect(getScrubberLeft(1, 180, 6)).toBe(174)
  })

  it('projects smooth playback using the remaining duration and active rate', () => {
    expect(getRemainingPlaybackMs(0.25, 20, 1)).toBe(15_000)
    expect(getRemainingPlaybackMs(0.25, 20, 1.5)).toBe(10_000)
    expect(getRemainingPlaybackMs(1, 20, 1)).toBe(0)
  })
})
