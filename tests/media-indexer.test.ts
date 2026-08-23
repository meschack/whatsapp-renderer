import { describe, expect, it } from 'vitest'

import { createMediaIndexer, type MediaCandidate } from '../utils/media-indexer'
import { readImageDimensions } from '../utils/image-dimensions'

describe('media indexer', () => {
  it('reads image dimensions from bounded headers without decoding pixels', () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47], 0)
    new DataView(png.buffer).setUint32(16, 4032)
    new DataView(png.buffer).setUint32(20, 3024)
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03, 0x01, 0x11,
      0x00
    ])

    expect(readImageDimensions(png)).toEqual({ width: 4032, height: 3024 })
    expect(readImageDimensions(jpeg)).toEqual({ width: 1920, height: 1080 })
  })

  it('indexes normalized metadata sequentially and reports item progress', async () => {
    const candidates: MediaCandidate[] = [
      { filename: 'photo.JPG', uri: 'file:///chat/photo.JPG', type: 'image', size: 4_000_000 },
      { filename: 'clip.mp4', uri: 'file:///chat/clip.mp4', type: 'video', size: 8_000_000 },
      { filename: 'voice.opus', uri: 'file:///chat/voice.opus', type: 'audio', size: 42_000 }
    ]
    let active = 0
    let maxActive = 0
    let yieldCount = 0
    const progress: Array<{ completed: number; total: number; filename: string }> = []
    const indexMedia = createMediaIndexer({
      inspect: async candidate => {
        active++
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active--

        if (candidate.type === 'image') {
          return { width: 4032, height: 3024, duration: null, previewUri: 'file:///chat/previews/0.jpg' }
        }
        if (candidate.type === 'video') {
          return { width: 1920, height: 1080, duration: 12.5, previewUri: 'file:///chat/previews/1.jpg' }
        }
        return { width: null, height: null, duration: 4.2, previewUri: null }
      },
      yieldToMainThread: async () => {
        yieldCount++
      }
    })

    const result = await indexMedia(candidates, update => progress.push(update))

    expect(result.get('photo.JPG')).toEqual({
      ...candidates[0],
      width: 4032,
      height: 3024,
      duration: null,
      previewUri: 'file:///chat/previews/0.jpg'
    })
    expect(result.get('clip.mp4')).toMatchObject({ type: 'video', duration: 12.5 })
    expect(result.get('voice.opus')).toMatchObject({ type: 'audio', duration: 4.2 })
    expect(maxActive).toBe(1)
    expect(yieldCount).toBe(candidates.length)
    expect(progress).toEqual([
      { completed: 1, total: 3, filename: 'photo.JPG' },
      { completed: 2, total: 3, filename: 'clip.mp4' },
      { completed: 3, total: 3, filename: 'voice.opus' }
    ])
  })

  it('keeps base metadata when a corrupt attachment cannot be inspected', async () => {
    const candidate: MediaCandidate = {
      filename: 'broken.webp',
      uri: 'file:///chat/broken.webp',
      type: 'image',
      size: 123
    }
    const indexMedia = createMediaIndexer({
      inspect: async () => {
        throw new Error('bad image')
      },
      yieldToMainThread: async () => {}
    })

    const result = await indexMedia([candidate])

    expect(result.get(candidate.filename)).toEqual({
      ...candidate,
      width: null,
      height: null,
      duration: null,
      previewUri: null
    })
  })
})
