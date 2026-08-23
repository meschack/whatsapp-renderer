import { audioPlaybackStore } from '@/store/audio-playback-store'
import {
  AUDIO_BAR_COUNT,
  hasUsableWaveformCoverage,
  normalizeWaveformBuckets
} from '@/utils/audio-presentation'
import {
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioSampleListener
} from 'expo-audio'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'

const PLAYBACK_RATES = [1, 1.5, 2] as const
const MAX_WAVEFORM_CACHE = 100

interface AudioPlayerControls {
  play: (uri: string) => Promise<void>
  pause: () => void
  seek: (fraction: number) => void
  cycleRate: () => void
}

const AudioControlsContext = createContext<AudioPlayerControls | null>(null)

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const statusRef = useRef(status)
  statusRef.current = status

  const activeUriRef = useRef<string | null>(null)
  const pendingPlayUriRef = useRef<string | null>(null)
  const rateIndexRef = useRef(0)
  const waveformBucketsRef = useRef<Map<string, number[]>>(new Map())
  const samplingPermissionRef = useRef<'unknown' | 'granted' | 'denied'>(
    process.env.EXPO_OS === 'android' ? 'unknown' : 'granted'
  )

  useEffect(() => {
    const uri = activeUriRef.current
    if (!uri) return

    const progress = status.duration > 0 ? status.currentTime / status.duration : 0
    audioPlaybackStore.updateActiveStatus({
      isPlaying: status.playing,
      progress,
      currentTime: status.currentTime,
      duration: status.duration,
      hasPlayed: status.currentTime > 0 || status.playing
    })

    if (status.duration > 0) audioPlaybackStore.setDuration(uri, status.duration)

    if (pendingPlayUriRef.current === uri && status.duration > 0 && !status.playing) {
      pendingPlayUriRef.current = null
      player.play()
    }
  }, [player, status.currentTime, status.duration, status.playing])

  useAudioSampleListener(player, sample => {
    const uri = activeUriRef.current
    const currentStatus = statusRef.current
    if (!uri || currentStatus.duration <= 0) return

    const frames = sample.channels[0]?.frames
    if (!frames || frames.length === 0) return

    let sum = 0
    for (let index = 0; index < frames.length; index++) sum += frames[index] * frames[index]
    const rms = Math.sqrt(sum / frames.length)
    const bucketIndex = Math.min(
      AUDIO_BAR_COUNT - 1,
      Math.floor((currentStatus.currentTime / currentStatus.duration) * AUDIO_BAR_COUNT)
    )
    const buckets = waveformBucketsRef.current.get(uri) ?? new Array(AUDIO_BAR_COUNT).fill(0)
    buckets[bucketIndex] = Math.max(buckets[bucketIndex], rms)
    waveformBucketsRef.current.delete(uri)
    waveformBucketsRef.current.set(uri, buckets)

    while (waveformBucketsRef.current.size > MAX_WAVEFORM_CACHE) {
      const oldest = waveformBucketsRef.current.keys().next().value
      if (!oldest) break
      waveformBucketsRef.current.delete(oldest)
    }
  })

  useEffect(() => {
    const uri = activeUriRef.current
    const didFinish =
      uri !== null &&
      status.duration > 0 &&
      !status.playing &&
      status.currentTime >= status.duration - 0.1
    if (!uri || !didFinish) return

    const buckets = waveformBucketsRef.current.get(uri)
    if (!buckets || !hasUsableWaveformCoverage(buckets)) return
    audioPlaybackStore.setWaveform(uri, normalizeWaveformBuckets(buckets))
  }, [status.currentTime, status.duration, status.playing])

  const ensureSamplingPermission = useCallback(async () => {
    if (process.env.EXPO_OS !== 'android' || samplingPermissionRef.current === 'granted') return
    if (samplingPermissionRef.current === 'denied') return

    const response = await requestRecordingPermissionsAsync()
    samplingPermissionRef.current = response.granted ? 'granted' : 'denied'
  }, [])

  const play = useCallback(
    async (uri: string) => {
      void ensureSamplingPermission()
      const currentStatus = statusRef.current

      if (uri === activeUriRef.current) {
        const didFinish =
          currentStatus.duration > 0 &&
          !currentStatus.playing &&
          currentStatus.currentTime >= currentStatus.duration - 0.1

        if (currentStatus.playing) player.pause()
        else if (didFinish) {
          await player.seekTo(0)
          player.play()
        } else player.play()
        return
      }

      activeUriRef.current = uri
      pendingPlayUriRef.current = uri
      rateIndexRef.current = 0
      audioPlaybackStore.setActiveUri(uri)
      player.replace({ uri })
    },
    [ensureSamplingPermission, player]
  )

  const pause = useCallback(() => player.pause(), [player])

  const seek = useCallback(
    (fraction: number) => {
      const duration = statusRef.current.duration
      if (duration > 0) void player.seekTo(fraction * duration)
    },
    [player]
  )

  const cycleRate = useCallback(() => {
    const nextIndex = (rateIndexRef.current + 1) % PLAYBACK_RATES.length
    rateIndexRef.current = nextIndex
    const rate = PLAYBACK_RATES[nextIndex]
    player.setPlaybackRate(rate)
    audioPlaybackStore.setPlaybackRate(rate)
  }, [player])

  useEffect(
    () => () => {
      audioPlaybackStore.setActiveUri(null)
    },
    []
  )

  const controls = useMemo(() => ({ play, pause, seek, cycleRate }), [play, pause, seek, cycleRate])

  return <AudioControlsContext.Provider value={controls}>{children}</AudioControlsContext.Provider>
}

export function useAudioPlayerControls() {
  const controls = useContext(AudioControlsContext)
  if (!controls) throw new Error('useAudioPlayerControls must be used within AudioPlayerProvider')
  return controls
}
