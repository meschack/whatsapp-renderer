export interface ImageDimensions {
  width: number
  height: number
}

const readUint16BE = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] << 8) | bytes[offset + 1]
const readUint16LE = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8)
const readUint32BE = (bytes: Uint8Array, offset: number) =>
  bytes[offset] * 0x1000000 +
  (bytes[offset + 1] << 16) +
  (bytes[offset + 2] << 8) +
  bytes[offset + 3]

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/** Read dimensions from common image headers without decoding the full bitmap. */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length >= 24 && ascii(bytes, 1, 3) === 'PNG') {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) }
  }

  if (bytes.length >= 10 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) {
    return { width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) }
  }

  if (bytes.length >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const format = ascii(bytes, 12, 4)
    if (format === 'VP8X') {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      return { width, height }
    }
    if (format === 'VP8L' && bytes[20] === 0x2f) {
      const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8)
      const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
      return { width, height }
    }
    if (format === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return {
        width: readUint16LE(bytes, 26) & 0x3fff,
        height: readUint16LE(bytes, 28) & 0x3fff
      }
    }
  }

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    const segmentLength = readUint16BE(bytes, offset + 2)
    if (segmentLength < 2) return null
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        width: readUint16BE(bytes, offset + 7),
        height: readUint16BE(bytes, offset + 5)
      }
    }
    offset += segmentLength + 2
  }
  return null
}
