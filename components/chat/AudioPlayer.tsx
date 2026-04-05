import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { memo, useCallback, useMemo, useState } from 'react'
import { type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { BAR_COUNT, useSharedAudioPlayer } from './AudioPlayerProvider'
import { MessageMeta } from './MessageMeta'

interface AudioPlayerProps {
  message: Message
  showMeta?: boolean
}

const DEFAULT_WAVEFORM_WIDTH = 154
const WAVEFORM_BAR_GAP = 2

export const AudioPlayer = memo(function AudioPlayer({
  message,
  showMeta = true
}: AudioPlayerProps) {
  const uri = message.mediaUri
  const isMine = message.isMine
  const { state, actions } = useSharedAudioPlayer()
  const [waveformWidth, setWaveformWidth] = useState(DEFAULT_WAVEFORM_WIDTH)
  const metadataPlayer = useAudioPlayer(uri ? { uri } : null)
  const metadataStatus = useAudioPlayerStatus(metadataPlayer)

  const isActive = uri !== null && state.activeUri === uri
  const progress = isActive ? state.progress : 0
  const isPlaying = isActive && state.isPlaying
  const liveCurrentTime = isActive && (state.isPlaying || state.hasPlayed) ? state.currentTime : 0
  const totalDuration = metadataStatus.duration || (isActive ? state.duration : 0)

  const displayDuration =
    liveCurrentTime > 0 ? formatSeconds(liveCurrentTime) : formatSeconds(totalDuration)

  const handlePlayPause = useCallback(() => {
    if (uri) {
      void actions.play(uri)
    }
  }, [uri, actions])

  const handleSeek = useCallback(
    (e: GestureResponderEvent) => {
      if (isActive && waveformWidth > 0) {
        const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / waveformWidth))
        actions.seek(fraction)
      }
    },
    [isActive, actions, waveformWidth]
  )

  const handleWaveformLayout = useCallback((e: LayoutChangeEvent) => {
    setWaveformWidth(e.nativeEvent.layout.width)
  }, [])

  const bars = useMemo(() => {
    if (uri && state.waveforms.has(uri)) {
      return state.waveforms.get(uri)!
    }

    return generateFallbackWaveform(uri ?? 'voice-note')
  }, [uri, state.waveforms])

  const dotPosition =
    waveformWidth > 0 ? Math.max(0, Math.min(waveformWidth - 14, progress * waveformWidth - 7)) : 0

  const avatar = (
    <View className='bg-wa-header/90 relative h-12 w-12 items-center justify-center rounded-full'>
      <Ionicons name='person' size={22} color='#B7C4CF' />
      <View className='bg-wa-bg absolute -right-0.5 -bottom-0.5 h-5 w-5 items-center justify-center rounded-full'>
        <Ionicons name='mic' size={13} color='#53BDEB' />
      </View>
    </View>
  )

  return (
    <View className='w-62.5 max-w-full flex-row items-center gap-3'>
      {isMine && avatar}

      <View className={`flex-1 overflow-hidden ${showMeta ? 'gap-2' : 'gap-0'}`}>
        <View className='flex-row items-center gap-3'>
          <Pressable onPress={handlePlayPause} className='h-9 w-9 items-center justify-center'>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={30}
              color={isMine ? '#E9EDEF' : '#D7D7D7'}
            />
          </Pressable>

          <Pressable onPress={handleSeek} onLayout={handleWaveformLayout} className='flex-1 py-1'>
            <View className='relative h-8 justify-center overflow-hidden'>
              <View className='flex-row items-center' style={{ gap: WAVEFORM_BAR_GAP }}>
                {bars.map((barHeight, index) => {
                  const barActive = index / BAR_COUNT <= progress
                  return (
                    <View
                      key={index}
                      className={
                        barActive
                          ? 'bg-wa-waveform-active rounded-full'
                          : 'rounded-full bg-white/38'
                      }
                      style={{ height: barHeight, width: 3 }}
                    />
                  )
                })}
              </View>

              <View
                className='absolute top-1/2 h-4 w-4 rounded-full bg-[#53BDEB]'
                style={{ left: dotPosition, marginTop: -8 }}
              />
            </View>
          </Pressable>
        </View>

        {showMeta && (
          <View className='flex-row items-center justify-between pl-1'>
            <Text className={`text-[11px] ${isMine ? 'text-white/65' : 'text-wa-text-secondary'}`}>
              {displayDuration}
            </Text>
            <MessageMeta message={message} />
          </View>
        )}
      </View>

      {!isMine && avatar}
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

function generateFallbackWaveform(seedKey: string): number[] {
  let seed = hashString(seedKey)
  const base = Array.from({ length: BAR_COUNT }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const noise = seed / 0xffffffff
    const envelope = 0.4 + 0.35 * Math.sin((index / BAR_COUNT) * Math.PI * 2.8 + noise * 2.4)
    const detail = 0.45 + noise * 0.55
    return 6 + Math.max(0.15, envelope + detail - 0.25) * 8
  })

  return smoothWaveform(base)
}

function smoothWaveform(values: number[]): number[] {
  return values.map((value, index) => {
    const previous = values[index - 1] ?? value
    const next = values[index + 1] ?? value
    return Math.round((previous + value * 2 + next) / 4)
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
