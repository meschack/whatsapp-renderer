import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('iOS playback and image viewer regressions', () => {
  it('releases exclusive audio focus after the terminal voice note', () => {
    const provider = readSource('components/chat/audio-player-provider.tsx')

    expect(provider).toContain('releaseAudioSessionAfterPlaybackSettles')
    expect(provider).toContain('setIsAudioActiveAsync(false)')
  })

  it('does not put the full-screen image viewer in a native modal', () => {
    const viewerSources = [
      readSource('components/chat/chat-image-viewer.tsx'),
      readSource('components/chat/media-viewer.tsx'),
      readSource('components/chat/image-album-modal.tsx')
    ]

    for (const viewer of viewerSources) expect(viewer).not.toMatch(/\bModal\b/)
  })
})
