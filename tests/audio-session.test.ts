import appConfig from '../app.json'
import {
  VOICE_PLAYBACK_AUDIO_MODE,
  advancePendingAudioTransition,
  releaseAudioSessionAfterPlaybackSettles,
  shouldRestorePlaybackRate,
  type PendingAudioTransition
} from '../utils/audio-session'
import { describe, expect, it, vi } from 'vitest'

describe('voice playback audio session', () => {
  it('takes exclusive audio focus and remains eligible for background playback', () => {
    expect(VOICE_PLAYBACK_AUDIO_MODE).toMatchObject({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false
    })

    const audioPlugin = appConfig.expo.plugins.find(
      plugin => Array.isArray(plugin) && plugin[0] === 'expo-audio'
    )
    expect(audioPlugin).toEqual([
      'expo-audio',
      expect.objectContaining({ enableBackgroundPlayback: true })
    ])
  })

  it('ignores stale playing status until the replacement source is actually ready', () => {
    const pending: PendingAudioTransition = {
      uri: 'file:///voice-2.opus',
      generation: 2,
      sawUnloaded: false
    }

    const stale = advancePendingAudioTransition(pending, {
      isLoaded: true,
      playing: true,
      currentTime: 12,
      duration: 12
    })
    expect(stale).toEqual({ pending, shouldPlay: false })

    const loading = advancePendingAudioTransition(pending, {
      isLoaded: false,
      playing: false,
      currentTime: 0,
      duration: 0
    })
    expect(loading.pending?.sawUnloaded).toBe(true)
    expect(loading.shouldPlay).toBe(false)

    const ready = advancePendingAudioTransition(loading.pending!, {
      isLoaded: true,
      playing: false,
      currentTime: 0,
      duration: 8
    })
    expect(ready).toEqual({ pending: null, shouldPlay: true })
  })

  it('reapplies a preferred speed after iOS restores the player at 1x', () => {
    expect(shouldRestorePlaybackRate(1.5, 1, true)).toBe(true)
    expect(shouldRestorePlaybackRate(1.5, 1.5, true)).toBe(false)
    expect(shouldRestorePlaybackRate(1.5, 1, false)).toBe(false)
  })

  it('lets the native player settle before releasing focus and cancels a stale release', async () => {
    const deactivate = vi.fn(async () => undefined)
    const release = releaseAudioSessionAfterPlaybackSettles(deactivate, () => true, 10)

    expect(deactivate).not.toHaveBeenCalled()
    await release
    expect(deactivate).toHaveBeenCalledOnce()

    const staleDeactivate = vi.fn(async () => undefined)
    const staleRelease = releaseAudioSessionAfterPlaybackSettles(staleDeactivate, () => false, 0)

    await expect(staleRelease).resolves.toBe(false)
    expect(staleDeactivate).not.toHaveBeenCalled()
  })
})
