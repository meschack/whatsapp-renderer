import { describe, expect, it } from 'vitest'

import { deriveAudioWaveform, MAX_WAVEFORM_BYTES } from '../utils/audio-waveform'
import {
  AUDIO_BAR_COUNT,
  AUDIO_BAR_MAX_HEIGHT,
  AUDIO_BAR_MIN_HEIGHT
} from '../utils/audio-presentation'

function createOggFixture(packetSizes: number[]): Uint8Array {
  const headerSize = 27 + packetSizes.length
  const bytes = new Uint8Array(headerSize + packetSizes.reduce((sum, size) => sum + size, 0))
  bytes.set([0x4f, 0x67, 0x67, 0x53], 0)
  bytes[26] = packetSizes.length
  packetSizes.forEach((size, index) => {
    bytes[27 + index] = size
  })
  for (let index = headerSize; index < bytes.length; index++) bytes[index] = index % 251
  return bytes
}

describe('offline audio waveform extraction', () => {
  it('turns bounded Ogg packet activity into normalized display buckets', () => {
    const bytes = createOggFixture([8, 20, 12, 80, 18, 64, 14, 110, 22, 55, 16, 90])

    const waveform = deriveAudioWaveform(bytes)

    expect(waveform).toHaveLength(AUDIO_BAR_COUNT)
    expect(Math.min(...waveform!)).toBeGreaterThanOrEqual(AUDIO_BAR_MIN_HEIGHT)
    expect(Math.max(...waveform!)).toBeLessThanOrEqual(AUDIO_BAR_MAX_HEIGHT)
    expect(new Set(waveform).size).toBeGreaterThan(3)
  })

  it('rejects corrupt audio so rows can use their deterministic visual fallback', () => {
    expect(deriveAudioWaveform(new Uint8Array(512).fill(7))).toBeNull()
    expect(deriveAudioWaveform(new Uint8Array(12))).toBeNull()
    expect(MAX_WAVEFORM_BYTES).toBe(2 * 1024 * 1024)
  })
})
