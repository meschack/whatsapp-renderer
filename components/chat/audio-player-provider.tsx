import { audioPlaybackStore } from '@/store/audio-playback-store'
import { useChatStore } from '@/store/chat-store'
import { getNextConsecutiveAudioUri } from '@/store/message-database'
import {
  getPreferredAudioPlaybackRate,
  setPreferredAudioPlaybackRate
} from '@/store/preference-database'
import { getNextPlaybackRate } from '@/utils/audio-presentation'
import {
  advancePendingAudioTransition,
  releaseAudioSessionAfterPlaybackSettles,
  shouldRestorePlaybackRate,
  VOICE_PLAYBACK_AUDIO_MODE,
  type PendingAudioTransition
} from '@/utils/audio-session'
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'

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
  const player = useAudioPlayer(null, {
    updateInterval: 100,
    keepAudioSessionActive: true,
    preferredForwardBufferDuration: 1
  })
  const status = useAudioPlayerStatus(player)
  const statusRef = useRef(status)
  statusRef.current = status

  const activeUriRef = useRef<string | null>(null)
  const pendingTransitionRef = useRef<PendingAudioTransition | null>(null)
  const transitionGenerationRef = useRef(0)
  const completionArmedRef = useRef(true)
  const playbackIntentRef = useRef(0)
  const playbackSessionActiveRef = useRef(false)
  const intendsToPlayRef = useRef(false)
  const previousChatIdRef = useRef(chatId)
  const initialPlaybackRate = useMemo(getPreferredAudioPlaybackRate, [])
  const preferredRateRef = useRef(initialPlaybackRate)

  const ensurePlaybackSession = useCallback(async () => {
    await setAudioModeAsync(VOICE_PLAYBACK_AUDIO_MODE)
    if (!playbackSessionActiveRef.current) {
      await setIsAudioActiveAsync(true)
      playbackSessionActiveRef.current = true
    }
    player.setActiveForLockScreen(true, {
      title: 'Voice message',
      artist: chatData?.chatName ?? 'Kinsay'
    })
  }, [chatData?.chatName, player])

  const endPlaybackSession = useCallback(async () => {
    const releaseIntent = playbackIntentRef.current
    intendsToPlayRef.current = false
    player.clearLockScreenControls()
    try {
      await releaseAudioSessionAfterPlaybackSettles(
        async () => {
          playbackSessionActiveRef.current = false
          await setIsAudioActiveAsync(false)
        },
        () =>
          playbackIntentRef.current === releaseIntent &&
          !intendsToPlayRef.current &&
          playbackSessionActiveRef.current
      )
    } catch (error) {
      console.error('Failed to release voice playback audio focus', error)
    }
  }, [player])

  const activateUri = useCallback(
    (uri: string) => {
      activeUriRef.current = uri
      intendsToPlayRef.current = true
      pendingTransitionRef.current = {
        uri,
        generation: ++transitionGenerationRef.current,
        sawUnloaded: false
      }
      const preferredRate = preferredRateRef.current
      audioPlaybackStore.setActiveUri(uri, preferredRate)
      player.replace({ uri })
    },
    [player]
  )

  useEffect(() => {
    void setAudioModeAsync(VOICE_PLAYBACK_AUDIO_MODE).catch(error => {
      console.error('Failed to configure voice playback', error)
    })
  }, [])

  useEffect(() => {
    const uri = activeUriRef.current
    if (!uri) return

    const pending = pendingTransitionRef.current
    if (pending) {
      const transition = advancePendingAudioTransition(pending, {
        isLoaded: status.isLoaded,
        playing: status.playing,
        currentTime: status.currentTime,
        duration: status.duration
      })
      pendingTransitionRef.current = transition.pending
      audioPlaybackStore.updateActiveStatus({
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: status.isLoaded ? status.duration : 0,
        hasPlayed: false
      })

      if (transition.shouldPlay) {
        player.setPlaybackRate(preferredRateRef.current)
        player.play()
      }
      return
    }

    const progress = status.duration > 0 ? status.currentTime / status.duration : 0
    audioPlaybackStore.updateActiveStatus({
      isPlaying: status.playing,
      progress,
      currentTime: status.currentTime,
      duration: status.duration,
      hasPlayed: status.currentTime > 0 || status.playing
    })

    if (status.duration > 0) audioPlaybackStore.setDuration(uri, status.duration)

    if (
      status.isLoaded &&
      shouldRestorePlaybackRate(preferredRateRef.current, status.playbackRate, Boolean(uri))
    ) {
      player.setPlaybackRate(preferredRateRef.current)
    }
    if (status.mediaServicesDidReset && intendsToPlayRef.current) player.play()
  }, [
    player,
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.mediaServicesDidReset,
    status.playbackRate,
    status.playing
  ])

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
        if (playbackIntentRef.current !== intent || activeUriRef.current !== finishedUri) {
          return
        }
        if (nextUri) {
          activateUri(nextUri)
          return
        }

        audioPlaybackStore.setActiveUri(null)
        activeUriRef.current = null
        void endPlaybackSession().catch(() => undefined)
      })
      .catch(() => {
        if (playbackIntentRef.current !== intent || activeUriRef.current !== finishedUri) return
        audioPlaybackStore.setActiveUri(null)
        activeUriRef.current = null
        void endPlaybackSession().catch(() => undefined)
      })
  }, [activateUri, chatId, endPlaybackSession, resolveNextAudioUri, status.didJustFinish])

  const play = useCallback(
    async (uri: string) => {
      playbackIntentRef.current += 1
      const currentStatus = statusRef.current
      try {
        await ensurePlaybackSession()
      } catch (error) {
        console.error('Failed to start voice playback', error)
        return
      }

      if (uri === activeUriRef.current) {
        const didFinish =
          currentStatus.duration > 0 &&
          !currentStatus.playing &&
          currentStatus.currentTime >= currentStatus.duration - 0.1

        if (currentStatus.playing) {
          player.pause()
          audioPlaybackStore.updateActiveStatus({
            isPlaying: false,
            progress: 0,
            currentTime: 0,
            duration: currentStatus.duration,
            hasPlayed: false
          })
          await endPlaybackSession()
        } else if (didFinish) {
          await player.seekTo(0)
          intendsToPlayRef.current = true
          player.setPlaybackRate(preferredRateRef.current)
          player.play()
        } else {
          intendsToPlayRef.current = true
          player.setPlaybackRate(preferredRateRef.current)
          player.play()
        }
        return
      }

      activateUri(uri)
    },
    [activateUri, endPlaybackSession, ensurePlaybackSession, player]
  )

  const pause = useCallback(() => {
    playbackIntentRef.current += 1
    player.pause()
    audioPlaybackStore.setActiveUri(null)
    activeUriRef.current = null
    pendingTransitionRef.current = null
    void endPlaybackSession().catch(() => undefined)
  }, [endPlaybackSession, player])

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
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || !activeUriRef.current) return
      player.setPlaybackRate(preferredRateRef.current)
      if (intendsToPlayRef.current && !pendingTransitionRef.current && !statusRef.current.playing) {
        player.play()
      }
    })
    return () => subscription.remove()
  }, [player])

  useEffect(() => {
    if (previousChatIdRef.current === chatId) return
    previousChatIdRef.current = chatId
    playbackIntentRef.current += 1
    pendingTransitionRef.current = null
    activeUriRef.current = null
    player.pause()
    audioPlaybackStore.setActiveUri(null)
    void endPlaybackSession().catch(() => undefined)
  }, [chatId, endPlaybackSession, player])

  useEffect(
    () => () => {
      playbackIntentRef.current += 1
      audioPlaybackStore.setActiveUri(null)
      player.clearLockScreenControls()
    },
    [player]
  )

  const controls = useMemo(() => ({ play, pause, seek, cycleRate }), [play, pause, seek, cycleRate])

  return <AudioControlsContext.Provider value={controls}>{children}</AudioControlsContext.Provider>
}

export function useAudioPlayerControls() {
  const controls = useContext(AudioControlsContext)
  if (!controls) throw new Error('useAudioPlayerControls must be used within AudioPlayerProvider')
  return controls
}
