import type { Message } from '@/models/types'
import { useAudioRowState } from '@/hooks/use-audio-row-state'
import { Pressable, Text, View } from '@/src/tw'
import {
  AUDIO_BAR_COUNT,
  formatPlaybackRate,
  getRemainingPlaybackMs,
  getScrubberLeft,
  getVisualAudioProgress,
  shouldShowPlaybackRate
} from '@/utils/audio-presentation'
import { Ionicons } from '@expo/vector-icons'
import { useRecyclingState } from '@shopify/flash-list'
import { memo, useCallback, useEffect, useMemo } from 'react'
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  useWindowDimensions
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useAudioPlayerControls } from './audio-player-provider'
import { MessageMeta } from './message-meta'
import { GeneratedAvatar } from '@/components/shared/generated-avatar'
import { performHapticFeedback } from '@/utils/haptic-feedback'

interface AudioPlayerProps {
  message: Message
  showMeta?: boolean
}

const DEFAULT_WAVEFORM_WIDTH = 180
const SCRUBBER_RADIUS = 6
const TRACK_SIDE_GUTTER = SCRUBBER_RADIUS

export const AudioPlayer = memo(function AudioPlayer({
  message,
  showMeta = true
}: AudioPlayerProps) {
  const uri = message.mediaUri
  const isMine = message.isMine
  const actions = useAudioPlayerControls()
  const state = useAudioRowState(uri ?? '')
  const { width: screenWidth } = useWindowDimensions()
  const [waveformWidth, setWaveformWidth] = useRecyclingState(DEFAULT_WAVEFORM_WIDTH, [message.id])
  const animatedProgress = useSharedValue(0)
  const playerWidth = Math.min(286, screenWidth * 0.76)

  const progress = getVisualAudioProgress(state)
  const isPlaying = state.isActive && state.isPlaying
  const showPlaybackRate = shouldShowPlaybackRate(state)
  const liveCurrentTime = isPlaying ? state.currentTime : 0

  const knownDuration = state.duration > 0 ? state.duration : (message.mediaDuration ?? 0)
  const displayDuration =
    liveCurrentTime > 0 ? formatSeconds(liveCurrentTime) : formatSeconds(knownDuration)

  const handlePlayPause = useCallback(() => {
    if (uri) {
      void actions.play(uri)
    }
  }, [uri, actions])

  const handleSeek = useCallback(
    (e: GestureResponderEvent) => {
      if (state.isActive && waveformWidth > 0) {
        const fraction = Math.max(
          0,
          Math.min(1, (e.nativeEvent.locationX - TRACK_SIDE_GUTTER) / waveformWidth)
        )
        animatedProgress.value = fraction
        actions.seek(fraction)
      }
    },
    [state.isActive, actions, animatedProgress, waveformWidth]
  )

  const handleWaveformLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setWaveformWidth(e.nativeEvent.layout.width)
    },
    [setWaveformWidth]
  )

  const handleAccessibilitySeek = useCallback(
    (event: AccessibilityActionEvent) => {
      if (!state.isActive) return
      const delta = event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1
      const next = Math.max(0, Math.min(1, progress + delta))
      animatedProgress.value = next
      actions.seek(next)
      performHapticFeedback('selection')
    },
    [actions, animatedProgress, progress, state.isActive]
  )

  const bars = useMemo(() => {
    return message.mediaWaveform ?? getFallbackWaveform(uri ?? 'voice-note')
  }, [message.mediaWaveform, uri])

  useEffect(() => {
    cancelAnimation(animatedProgress)
    if (!isPlaying || state.duration <= 0) {
      animatedProgress.value = 0
      return
    }

    animatedProgress.value = withTiming(1, {
      duration: getRemainingPlaybackMs(progress, state.duration, state.playbackRate),
      easing: Easing.linear
    })
  }, [animatedProgress, isPlaying, progress, state.duration, state.playbackRate])

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedProgress.value * waveformWidth }]
  }))

  const avatar = (
    <GeneratedAvatar
      name={message.sender ?? 'Unknown'}
      size={40}
      badge={
        <View className='bg-wa-bg absolute -bottom-0.5 -left-0.5 size-4.5 items-center justify-center rounded-full'>
          <Ionicons name='mic' size={11} color='#53BDEB' />
        </View>
      }
    />
  )

  const trailingControl = showPlaybackRate ? (
    <Pressable
      accessibilityLabel={`Playback speed ${formatPlaybackRate(state.playbackRate)}`}
      accessibilityHint='Double tap to change playback speed'
      accessibilityRole='button'
      onPress={() => {
        actions.cycleRate()
        performHapticFeedback('selection')
      }}
      className='h-7 w-11 items-center justify-center rounded-full'
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.58)' }}
    >
      <Text className='text-[12px] font-medium text-white'>
        {formatPlaybackRate(state.playbackRate)}
      </Text>
    </Pressable>
  ) : (
    avatar
  )

  return (
    <View className='max-w-full flex-row items-center' style={{ width: playerWidth }}>
      <Pressable
        accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} voice message`}
        accessibilityRole='button'
        accessibilityState={{ disabled: !uri }}
        className='size-11 items-center justify-center'
        disabled={!uri}
        onPress={handlePlayPause}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color='#AEBAC1' />
      </Pressable>

      <View className='mx-1 flex-1 overflow-hidden'>
        <Pressable
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityLabel='Voice message playback position'
          accessibilityRole='adjustable'
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress * 100),
            text: `${displayDuration} played`
          }}
          onAccessibilityAction={handleAccessibilitySeek}
          onPress={handleSeek}
          className='py-0.5'
        >
          <View
            onLayout={handleWaveformLayout}
            className='relative h-7 justify-center overflow-visible'
            style={{ marginHorizontal: TRACK_SIDE_GUTTER }}
          >
            <View className='flex-row items-center justify-between'>
              {bars.map((barHeight, index) => {
                const barActive = progress > 0 && (index + 0.5) / bars.length <= progress
                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: barActive
                        ? '#F1F4F5'
                        : isMine
                          ? 'rgba(255,255,255,0.36)'
                          : '#6F787D',
                      borderRadius: 2,
                      height: barHeight,
                      width: 2
                    }}
                  />
                )
              })}
            </View>

            <Animated.View
              style={[
                {
                  backgroundColor: '#53BDEB',
                  borderRadius: SCRUBBER_RADIUS,
                  height: SCRUBBER_RADIUS * 2,
                  left: getScrubberLeft(0, waveformWidth, SCRUBBER_RADIUS),
                  marginTop: -SCRUBBER_RADIUS,
                  position: 'absolute',
                  top: '50%',
                  width: SCRUBBER_RADIUS * 2
                },
                animatedDotStyle
              ]}
            />
          </View>
        </Pressable>

        {showMeta && (
          <View className='mt-0.5 flex-row items-center justify-between px-1.5'>
            <Text className={`text-[11px] ${isMine ? 'text-white/65' : 'text-wa-text-secondary'}`}>
              {displayDuration}
            </Text>
            <MessageMeta message={message} />
          </View>
        )}
      </View>

      <View className='ml-2 w-11 items-center justify-center'>{trailingControl}</View>
    </View>
  )
})

const formatSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fallbackWaveforms = new Map<string, number[]>()
const MAX_FALLBACK_WAVEFORMS = 200

function getFallbackWaveform(seedKey: string): number[] {
  const cached = fallbackWaveforms.get(seedKey)
  if (cached) return cached

  let seed = hashString(seedKey)
  const base = Array.from({ length: AUDIO_BAR_COUNT }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const noise = seed / 0xffffffff
    const envelope = 0.7 + 0.3 * Math.sin((index / AUDIO_BAR_COUNT) * Math.PI * 3.2 + 0.6)
    return 3 + Math.pow(noise, 1.25) * 15 * envelope
  })

  const waveform = smoothWaveform(base)
  fallbackWaveforms.set(seedKey, waveform)
  if (fallbackWaveforms.size > MAX_FALLBACK_WAVEFORMS) {
    const oldest = fallbackWaveforms.keys().next().value
    if (oldest) fallbackWaveforms.delete(oldest)
  }
  return waveform
}

function smoothWaveform(values: number[]): number[] {
  return values.map((value, index) => {
    const previous = values[index - 1] ?? value
    const next = values[index + 1] ?? value
    return Math.round((previous + value * 4 + next) / 6)
  })
}

function hashString(value: string): number {
  let hash = 2166136261

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
