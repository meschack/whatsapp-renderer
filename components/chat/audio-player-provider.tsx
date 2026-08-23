import { audioPlaybackStore } from '@/store/audio-playback-store'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'

const PLAYBACK_RATES = [1, 1.5, 2] as const

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

  const play = useCallback(
    async (uri: string) => {
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
    [player]
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
