import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAudioPlayer, useAudioPlayerStatus, useAudioSampleListener } from 'expo-audio'

const PLAYBACK_RATES = [1, 1.5, 2] as const
type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export const BAR_COUNT = 30
const DEFAULT_BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => Math.sin(i * 0.7) * 8 + 12)

function normalizeWaveform(buckets: number[]): number[] {
  const max = Math.max(...buckets, 0.001)
  return buckets.map(v => 4 + (v / max) * 16)
}

interface AudioPlayerState {
  activeUri: string | null
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number
  hasPlayed: boolean
  playbackRate: PlaybackRate
  waveform: number[]
}

interface AudioPlayerActions {
  play: (uri: string) => void
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
  // Committed waveforms: only updated when a track finishes, so the display is always clean
  const [committedWaveforms, setCommittedWaveforms] = useState<Map<string, number[]>>(new Map())
  const pendingPlayRef = useRef(false)

  // Raw RMS buckets collected silently during playback — never cause re-renders
  const waveformBucketsRef = useRef<Map<string, number[]>>(new Map())
  const activeUriRef = useRef<string | null>(null)
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)

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

  // Silently accumulate RMS per time-bucket — no state updates here
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
  })

  // Commit the collected waveform once when the track finishes — one clean update
  useEffect(() => {
    if (!didFinish || !activeUri) return
    const buckets = waveformBucketsRef.current.get(activeUri)
    if (!buckets || buckets.every(v => v === 0)) return
    const normalized = normalizeWaveform(buckets)
    setCommittedWaveforms(prev => new Map(prev).set(activeUri, normalized))
  }, [didFinish, activeUri])

  // Auto-play when the player loads a new source
  useEffect(() => {
    if (pendingPlayRef.current && status.duration > 0 && !status.playing) {
      pendingPlayRef.current = false
      player.play()
    }
  }, [status.duration, status.playing, player])

  const play = useCallback(
    (uri: string) => {
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
        player.replace({ uri })
      }
    },
    [activeUri, player, status.playing, didFinish]
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

  // Use committed (complete) waveform if available, otherwise default sine
  const waveform = activeUri
    ? (committedWaveforms.get(activeUri) ?? DEFAULT_BAR_HEIGHTS)
    : DEFAULT_BAR_HEIGHTS

  const state: AudioPlayerState = useMemo(
    () => ({
      activeUri,
      isPlaying: status.playing,
      progress,
      currentTime: status.currentTime,
      duration: status.duration,
      hasPlayed,
      playbackRate: PLAYBACK_RATES[rateIndex],
      waveform
    }),
    [activeUri, status.playing, progress, status.currentTime, status.duration, hasPlayed, rateIndex, waveform]
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
