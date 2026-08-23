import { AudioPlaybackStore } from '../store/audio-playback-store'
import { describe, expect, it, vi } from 'vitest'

describe('AudioPlaybackStore', () => {
  it('notifies only the active audio row for progress changes', () => {
    const store = new AudioPlaybackStore()
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    store.subscribe('first.opus', firstListener)
    store.subscribe('second.opus', secondListener)
    store.setActiveUri('first.opus')
    firstListener.mockClear()
    secondListener.mockClear()

    store.updateActiveStatus({
      isPlaying: true,
      progress: 0.25,
      currentTime: 3,
      duration: 12,
      hasPlayed: true
    })

    expect(firstListener).toHaveBeenCalledOnce()
    expect(secondListener).not.toHaveBeenCalled()
    expect(store.getSnapshot('first.opus').progress).toBe(0.25)
  })

  it('notifies the previous and next row once when playback moves', () => {
    const store = new AudioPlaybackStore()
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    store.subscribe('first.opus', firstListener)
    store.subscribe('second.opus', secondListener)
    store.setActiveUri('first.opus')
    firstListener.mockClear()
    secondListener.mockClear()

    store.setActiveUri('second.opus')

    expect(firstListener).toHaveBeenCalledOnce()
    expect(secondListener).toHaveBeenCalledOnce()
    expect(store.getSnapshot('first.opus').isActive).toBe(false)
    expect(store.getSnapshot('second.opus').isActive).toBe(true)
  })

  it('caches duration and waveform without changing unrelated rows', () => {
    const store = new AudioPlaybackStore()
    const unrelatedListener = vi.fn()
    store.subscribe('other.opus', unrelatedListener)

    store.setDuration('voice.opus', 42)
    store.setWaveform('voice.opus', [4, 8, 12])

    expect(unrelatedListener).not.toHaveBeenCalled()
    expect(store.getSnapshot('voice.opus')).toMatchObject({
      duration: 42,
      waveform: [4, 8, 12]
    })
  })
})
