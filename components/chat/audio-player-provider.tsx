import { audioPlaybackStore } from '@/store/audio-playback-store'
import { useChatStore } from '@/store/chat-store'
import { getNextConsecutiveAudioUri } from '@/store/message-database'
import {
  getPreferredAudioPlaybackRate,
  setPreferredAudioPlaybackRate
} from '@/store/preference-database'
import { getNextPlaybackRate } from '@/utils/audio-presentation'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'

interface AudioPlayerControls {
  play: (uri: string) => Promise<void>
  pause: () => void
  seek: (fraction: number) => void
  cycleRate: () => void
}

const AudioControlsContext = createContext<AudioPlayerControls | null>(null)

type NextAudioResolver = (chatId: string, currentUri: string) => Promise<string | null>

interface AudioPlayerProviderProps {
  children: React.ReactNode
  resolveNextAudioUri?: NextAudioResolver
}

export function AudioPlayerProvider({
  children,
  resolveNextAudioUri = getNextConsecutiveAudioUri
}: AudioPlayerProviderProps) {
  const { chatData } = useChatStore()
  const chatId = chatData?.chatId ?? null
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const statusRef = useRef(status)
  statusRef.current = status

  const activeUriRef = useRef<string | null>(null)
  const pendingPlayUriRef = useRef<string | null>(null)
  const completionArmedRef = useRef(true)
  const playbackIntentRef = useRef(0)
  const previousChatIdRef = useRef(chatId)
  const initialPlaybackRate = useMemo(getPreferredAudioPlaybackRate, [])
  const preferredRateRef = useRef(initialPlaybackRate)

  const activateUri = useCallback(
    (uri: string) => {
      activeUriRef.current = uri
      pendingPlayUriRef.current = uri
      const preferredRate = preferredRateRef.current
      audioPlaybackStore.setActiveUri(uri, preferredRate)
      player.replace({ uri })
      player.setPlaybackRate(preferredRate)
    },
    [player]
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
      player.setPlaybackRate(preferredRateRef.current)
      player.play()
    }
  }, [player, status.currentTime, status.duration, status.playing])

  useEffect(() => {
    if (!status.didJustFinish) {
      completionArmedRef.current = true
      return
    }

    if (!completionArmedRef.current) return
    completionArmedRef.current = false

    const finishedUri = activeUriRef.current
    if (!chatId || !finishedUri) return

    const intent = playbackIntentRef.current
    void resolveNextAudioUri(chatId, finishedUri)
      .then(nextUri => {
        if (
          !nextUri ||
          playbackIntentRef.current !== intent ||
          activeUriRef.current !== finishedUri
        ) {
          return
        }
        activateUri(nextUri)
      })
      .catch(() => {
        // A lookup failure ends the chain; it must never interrupt the chat screen.
      })
  }, [activateUri, chatId, resolveNextAudioUri, status.didJustFinish])

  const play = useCallback(
    async (uri: string) => {
      playbackIntentRef.current += 1
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

      activateUri(uri)
    },
    [activateUri, player]
  )

  const pause = useCallback(() => {
    playbackIntentRef.current += 1
    player.pause()
  }, [player])

  const seek = useCallback(
    (fraction: number) => {
      playbackIntentRef.current += 1
      const duration = statusRef.current.duration
      if (duration > 0) void player.seekTo(fraction * duration)
    },
    [player]
  )

  const cycleRate = useCallback(() => {
    const rate = getNextPlaybackRate(preferredRateRef.current)
    preferredRateRef.current = rate
    player.setPlaybackRate(rate)
    audioPlaybackStore.setPlaybackRate(rate)
    setPreferredAudioPlaybackRate(rate)
  }, [player])

  useEffect(() => {
    if (previousChatIdRef.current === chatId) return
    previousChatIdRef.current = chatId
    playbackIntentRef.current += 1
    pendingPlayUriRef.current = null
    activeUriRef.current = null
    player.pause()
    audioPlaybackStore.setActiveUri(null)
  }, [chatId, player])

  useEffect(
    () => () => {
      playbackIntentRef.current += 1
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
