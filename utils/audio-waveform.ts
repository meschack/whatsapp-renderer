import { AUDIO_BAR_COUNT, normalizeWaveformBuckets } from './audio-presentation'

export const MAX_WAVEFORM_BYTES = 2 * 1024 * 1024

export function deriveAudioWaveform(
  bytes: Uint8Array,
  bucketCount = AUDIO_BAR_COUNT
): number[] | null {
  if (bytes.length < 64 || bucketCount < 1) return null

  const oggPackets = readOggAudioPacketSizes(bytes)
  if (oggPackets.length > 0) {
    return normalizeWaveformBuckets(resampleValues(oggPackets, bucketCount))
  }

  if (!isRecognizedAudio(bytes)) return null
  return normalizeWaveformBuckets(readByteActivity(bytes, bucketCount))
}

function readOggAudioPacketSizes(bytes: Uint8Array): number[] {
  if (!matchesAscii(bytes, 0, 'OggS')) return []

  const packetSizes: number[] = []
  let packetSize = 0
  let offset = 0

  while (offset + 27 <= bytes.length) {
    if (!matchesAscii(bytes, offset, 'OggS')) return []
    const segmentCount = bytes[offset + 26]
    const tableOffset = offset + 27
    const bodyOffset = tableOffset + segmentCount
    if (bodyOffset > bytes.length) return []

    let bodySize = 0
    for (let index = 0; index < segmentCount; index++) bodySize += bytes[tableOffset + index]
    if (bodyOffset + bodySize > bytes.length) break

    for (let index = 0; index < segmentCount; index++) {
      const lace = bytes[tableOffset + index]
      packetSize += lace
      if (lace < 255) {
        packetSizes.push(packetSize)
        packetSize = 0
      }
    }
    offset = bodyOffset + bodySize
  }

  // OpusHead and OpusTags are metadata packets, not sound.
  return packetSizes.length > 2 ? packetSizes.slice(2) : []
}

function isRecognizedAudio(bytes: Uint8Array): boolean {
  const isMp3 = matchesAscii(bytes, 0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  const isAdts = bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
  const isIsoMedia = matchesAscii(bytes, 4, 'ftyp')
  return isMp3 || isAdts || isIsoMedia
}

function readByteActivity(bytes: Uint8Array, bucketCount: number): number[] {
  return Array.from({ length: bucketCount }, (_, bucket) => {
    const start = Math.floor((bucket * bytes.length) / bucketCount)
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * bytes.length) / bucketCount))
    let activity = 0
    for (let index = start + 1; index < end; index++) {
      activity += Math.abs(bytes[index] - bytes[index - 1])
    }
    return activity / Math.max(1, end - start - 1)
  })
}

function resampleValues(values: number[], bucketCount: number): number[] {
  return Array.from({ length: bucketCount }, (_, bucket) => {
    const start = Math.floor((bucket * values.length) / bucketCount)
    const end = Math.max(start + 1, Math.ceil(((bucket + 1) * values.length) / bucketCount))
    let sum = 0
    let count = 0
    for (let index = start; index < Math.min(end, values.length); index++) {
      sum += values[index]
      count++
    }
    return count > 0 ? sum / count : (values.at(-1) ?? 0)
  })
}

function matchesAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.length) return false
  for (let index = 0; index < value.length; index++) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}
