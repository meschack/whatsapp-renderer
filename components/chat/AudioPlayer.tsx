import { Pressable, Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useRef } from 'react'
import { type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { BAR_COUNT, useSharedAudioPlayer } from './AudioPlayerProvider'

interface AudioPlayerProps {
  uri: string | null
  isMine: boolean
  duration?: string
}

export const AudioPlayer = memo(function AudioPlayer({ uri, isMine, duration }: AudioPlayerProps) {
  const { state, actions } = useSharedAudioPlayer()
  const waveformWidth = useRef(0)

  const isActive = uri !== null && state.activeUri === uri

  // Derive display values — only show live data if this is the active track
  const progress = isActive ? state.progress : 0
  const isPlaying = isActive && state.isPlaying
  const hasPlayed = isActive && state.hasPlayed
  const playbackRate = isActive ? state.playbackRate : 1

  const displayDuration =
    isActive && state.duration > 0
      ? state.isPlaying || state.hasPlayed
        ? formatSeconds(state.currentTime)
        : formatSeconds(state.duration)
      : (duration ?? '0:00')

  const handlePlayPause = useCallback(() => {
    if (uri) actions.play(uri)
  }, [uri, actions])

  const handleSeek = useCallback(
    (e: GestureResponderEvent) => {
      if (isActive && waveformWidth.current > 0) {
        const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / waveformWidth.current))
        actions.seek(fraction)
      }
    },
    [isActive, actions]
  )

  const handleCycleRate = useCallback(() => {
    if (isActive) actions.cycleRate()
  }, [isActive, actions])

  const handleWaveformLayout = useCallback((e: LayoutChangeEvent) => {
    waveformWidth.current = e.nativeEvent.layout.width
  }, [])

  const bars = isActive ? state.waveform : undefined
  const showRateButton = isPlaying || hasPlayed

  return (
    <View className='min-w-50 flex-row items-center gap-2 py-1'>
      {showRateButton ? (
        <Pressable
          onPress={handleCycleRate}
          className='bg-wa-accent-light/30 h-10 w-10 items-center justify-center rounded-full'
        >
          <Text className='text-wa-accent-light text-xs font-bold'>{playbackRate}x</Text>
        </Pressable>
      ) : (
        <View className='bg-wa-accent-light/30 h-10 w-10 items-center justify-center rounded-full'>
          <Ionicons name='person' size={20} color='#06CF9C' />
        </View>
      )}

      <Pressable onPress={handlePlayPause} className='p-1'>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={28}
          color={isMine ? '#E9EDEF' : '#8696A0'}
        />
      </Pressable>

      <View className='flex-1 gap-1'>
        <Pressable
          onPress={handleSeek}
          onLayout={handleWaveformLayout}
          className='h-6 flex-row items-center gap-px'
        >
          {Array.from({ length: BAR_COUNT }, (_, i) => {
            const barHeight = bars?.[i] ?? Math.sin(i * 0.7) * 8 + 12
            const barActive = i / BAR_COUNT <= progress
            return (
              <View
                key={i}
                className={`w-[3px] rounded-full ${barActive ? 'bg-wa-waveform-active' : isMine ? 'bg-white/40' : 'bg-wa-waveform'}`}
                style={{ height: barHeight }}
              />
            )
          })}
        </Pressable>

        <Text className={`text-[11px] ${isMine ? 'text-white/60' : 'text-wa-text-secondary'}`}>
          {displayDuration}
        </Text>
      </View>
    </View>
  )
})

const formatSeconds = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
