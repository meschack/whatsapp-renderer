import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioSampleListener
} from 'expo-audio'

const PLAYBACK_RATES = [1, 1.5, 2] as const
type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export const BAR_COUNT = 40
const MIN_BAR_HEIGHT = 4
const MAX_BAR_HEIGHT = 22

function normalizeWaveform(buckets: number[]): number[] {
  const max = Math.max(...buckets, 0.001)
  return buckets.map(v => MIN_BAR_HEIGHT + Math.pow(v / max, 0.6) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT))
}

interface AudioPlayerState {
  activeUri: string | null
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number
  hasPlayed: boolean
  playbackRate: PlaybackRate
  waveforms: Map<string, number[]>
}

interface AudioPlayerActions {
  play: (uri: string) => Promise<void>
  pause: () => void
  seek: (fraction: number) => void
  cycleRate: () => void
}

interface AudioPlayerContextValue {
  state: AudioPlayerState
  actions: AudioPlayerActions
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [rateIndex, setRateIndex] = useState(0)
  const [waveforms, setWaveforms] = useState<Map<string, number[]>>(new Map())
  const pendingPlayRef = useRef(false)

  const waveformBucketsRef = useRef<Map<string, number[]>>(new Map())
  const activeUriRef = useRef<string | null>(null)
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)
  const lastWaveformCommitRef = useRef(0)
  const samplingPermissionRef = useRef<'unknown' | 'granted' | 'denied'>(
    process.env.EXPO_OS === 'android' ? 'unknown' : 'granted'
  )

  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)

  // Keep refs in sync for the sample listener (avoids stale closures)
  activeUriRef.current = activeUri
  currentTimeRef.current = status.currentTime
  durationRef.current = status.duration

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0
  const hasPlayed = status.currentTime > 0 || status.playing
  const didFinish =
    status.duration > 0 && !status.playing && status.currentTime >= status.duration - 0.1

  useAudioSampleListener(player, (sample) => {
    const uri = activeUriRef.current
    const duration = durationRef.current
    if (!uri || duration <= 0) return

    const frames = sample.channels[0]?.frames
    if (!frames || frames.length === 0) return

    let sum = 0
    for (let i = 0; i < frames.length; i++) sum += frames[i] * frames[i]
    const rms = Math.sqrt(sum / frames.length)

    const bucketIndex = Math.min(
      BAR_COUNT - 1,
      Math.floor((currentTimeRef.current / duration) * BAR_COUNT)
    )

    const existing = waveformBucketsRef.current.get(uri) ?? new Array(BAR_COUNT).fill(0)
    existing[bucketIndex] = Math.max(existing[bucketIndex], rms)
    waveformBucketsRef.current.set(uri, existing)

    const now = Date.now()
    if (now - lastWaveformCommitRef.current < 120 && bucketIndex < BAR_COUNT - 1) {
      return
    }

    lastWaveformCommitRef.current = now
    setWaveforms(prev => new Map(prev).set(uri, normalizeWaveform(existing)))
  })

  useEffect(() => {
    if (!didFinish || !activeUri) return
    const buckets = waveformBucketsRef.current.get(activeUri)
    if (!buckets || buckets.every(v => v === 0)) return
    setWaveforms(prev => new Map(prev).set(activeUri, normalizeWaveform(buckets)))
  }, [didFinish, activeUri])

  useEffect(() => {
    if (pendingPlayRef.current && status.duration > 0 && !status.playing) {
      pendingPlayRef.current = false
      player.play()
    }
  }, [status.duration, status.playing, player])

  const ensureSamplingPermission = useCallback(async () => {
    if (process.env.EXPO_OS !== 'android') {
      return true
    }

    if (samplingPermissionRef.current === 'granted') {
      return true
    }

    const response = await requestRecordingPermissionsAsync()
    samplingPermissionRef.current = response.granted ? 'granted' : 'denied'
    return response.granted
  }, [])

  const play = useCallback(
    async (uri: string) => {
      await ensureSamplingPermission()

      if (uri === activeUri) {
        if (status.playing) {
          player.pause()
        } else if (didFinish) {
          player.seekTo(0)
          player.play()
        } else {
          player.play()
        }
      } else {
        setActiveUri(uri)
        setRateIndex(0)
        pendingPlayRef.current = true
        lastWaveformCommitRef.current = 0
        player.replace({ uri })
      }
    },
    [activeUri, player, status.playing, didFinish, ensureSamplingPermission]
  )

  const pause = useCallback(() => {
    player.pause()
  }, [player])

  const seek = useCallback(
    (fraction: number) => {
      if (status.duration > 0) {
        player.seekTo(fraction * status.duration)
      }
    },
    [player, status.duration]
  )

  const cycleRate = useCallback(() => {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length
    setRateIndex(nextIndex)
    player.setPlaybackRate(PLAYBACK_RATES[nextIndex])
  }, [rateIndex, player])

  const state: AudioPlayerState = useMemo(
    () => ({
      activeUri,
      isPlaying: status.playing,
      progress,
      currentTime: status.currentTime,
      duration: status.duration,
      hasPlayed,
      playbackRate: PLAYBACK_RATES[rateIndex],
      waveforms
    }),
    [activeUri, status.playing, progress, status.currentTime, status.duration, hasPlayed, rateIndex, waveforms]
  )

  const actions: AudioPlayerActions = useMemo(
    () => ({ play, pause, seek, cycleRate }),
    [play, pause, seek, cycleRate]
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
}

export function useSharedAudioPlayer() {
  const ctx = useContext(AudioPlayerContext)
  if (!ctx) {
    throw new Error('useSharedAudioPlayer must be used within AudioPlayerProvider')
  }
  return ctx
}
