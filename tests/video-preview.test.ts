import { describe, expect, it, vi } from 'vitest'

import { loadVideoPreviewFrame } from '../utils/video-preview'

describe('video preview loading', () => {
  it('waits for source metadata before asking the native player for a frame', async () => {
    let ready = false
    let notifyReady = () => {}
    const generate = vi.fn(async () => 'frame')

    const frame = loadVideoPreviewFrame({
      isReady: () => ready,
      subscribe(onReady) {
        notifyReady = onReady
        return () => undefined
      },
      generate
    })

    await Promise.resolve()
    expect(generate).not.toHaveBeenCalled()

    ready = true
    notifyReady()

    await expect(frame).resolves.toBe('frame')
    expect(generate).toHaveBeenCalledOnce()
  })

  it('generates immediately when the source is already loaded', async () => {
    const generate = vi.fn(async () => 'frame')

    await expect(
      loadVideoPreviewFrame({
        isReady: () => true,
        subscribe: () => () => undefined,
        generate
      })
    ).resolves.toBe('frame')
    expect(generate).toHaveBeenCalledOnce()
  })
})
