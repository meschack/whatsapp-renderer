import { Pressable, Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'

interface AudioPlayerProps {
  uri: string | null
  isMine: boolean
  duration?: string
}

const BAR_COUNT = 30

const generateBarHeights = (count: number): number[] => {
  const heights: number[] = []
  for (let i = 0; i < count; i++) {
    heights.push(Math.sin(i * 0.7) * 8 + 12)
  }
  return heights
}

const PLAYBACK_RATES = [1, 1.5, 2] as const

export const AudioPlayer = ({ uri, isMine, duration }: AudioPlayerProps) => {
  if (!uri) {
    return <AudioPlaceholder isMine={isMine} duration={duration} />
  }
  return <AudioPlayerActive uri={uri} isMine={isMine} duration={duration} />
}

const AudioPlaceholder = ({ isMine, duration }: { isMine: boolean; duration?: string }) => {
  const barHeights = useMemo(() => generateBarHeights(BAR_COUNT), [])

  return (
    <AudioPlayerUI
      barHeights={barHeights}
      isMine={isMine}
      duration={duration}
      progress={0}
      isPlaying={false}
      hasPlayed={false}
      playbackRate={1}
      onPlayPause={() => {}}
      onSeek={() => {}}
      onCycleRate={() => {}}
    />
  )
}

interface AudioPlayerActiveProps {
  uri: string
  isMine: boolean
  duration?: string
}

const AudioPlayerActive = ({ uri, isMine, duration }: AudioPlayerActiveProps) => {
  const source = useMemo(() => ({ uri }), [uri])
  const player = useAudioPlayer(source)
  const status = useAudioPlayerStatus(player)
  const barHeights = useMemo(() => generateBarHeights(BAR_COUNT), [])
  const [rateIndex, setRateIndex] = useState(0)

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0
  const hasPlayed = status.currentTime > 0 || status.playing
  const didFinish = status.duration > 0 && !status.playing && status.currentTime >= status.duration - 0.1

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause()
    } else if (didFinish) {
      player.seekTo(0)
      player.play()
    } else {
      player.play()
    }
  }, [status.playing, didFinish, player])

  const handleSeek = useCallback(
    (fraction: number) => {
      if (status.duration > 0) {
        const target = fraction * status.duration
        player.seekTo(target)
      }
    },
    [status.duration, player]
  )

  const handleCycleRate = useCallback(() => {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length
    setRateIndex(nextIndex)
    player.setPlaybackRate(PLAYBACK_RATES[nextIndex])
  }, [rateIndex, player])

  const displayDuration =
    status.duration > 0
      ? status.playing || hasPlayed
        ? formatSeconds(status.currentTime)
        : formatSeconds(status.duration)
      : (duration ?? '0:00')

  return (
    <AudioPlayerUI
      barHeights={barHeights}
      isMine={isMine}
      duration={displayDuration}
      progress={progress}
      isPlaying={status.playing}
      hasPlayed={hasPlayed}
      playbackRate={PLAYBACK_RATES[rateIndex]}
      onPlayPause={handlePlayPause}
      onSeek={handleSeek}
      onCycleRate={handleCycleRate}
    />
  )
}

interface AudioPlayerUIProps {
  barHeights: number[]
  isMine: boolean
  duration?: string
  progress: number
  isPlaying: boolean
  hasPlayed: boolean
  playbackRate: number
  onPlayPause: () => void
  onSeek: (fraction: number) => void
  onCycleRate: () => void
}

const AudioPlayerUI = ({
  barHeights,
  isMine,
  duration,
  progress,
  isPlaying,
  hasPlayed,
  playbackRate,
  onPlayPause,
  onSeek,
  onCycleRate
}: AudioPlayerUIProps) => {
  const waveformWidth = useRef(0)

  const handleWaveformLayout = useCallback((e: LayoutChangeEvent) => {
    waveformWidth.current = e.nativeEvent.layout.width
  }, [])

  const handleWaveformPress = useCallback(
    (e: GestureResponderEvent) => {
      if (waveformWidth.current > 0) {
        const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / waveformWidth.current))
        onSeek(fraction)
      }
    },
    [onSeek]
  )

  const showRateButton = isPlaying || hasPlayed

  return (
    <View className='min-w-[200px] flex-row items-center gap-2 py-1'>
      {showRateButton ? (
        <Pressable
          onPress={onCycleRate}
          className='bg-wa-accent-light/30 h-10 w-10 items-center justify-center rounded-full'
        >
          <Text className='text-xs font-bold text-wa-accent-light'>{playbackRate}x</Text>
        </Pressable>
      ) : (
        <View className='bg-wa-accent-light/30 h-10 w-10 items-center justify-center rounded-full'>
          <Ionicons name='person' size={20} color='#06CF9C' />
        </View>
      )}

      <Pressable onPress={onPlayPause} className='p-1'>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={28}
          color={isMine ? '#E9EDEF' : '#8696A0'}
        />
      </Pressable>

      <View className='flex-1 gap-1'>
        <Pressable
          onPress={handleWaveformPress}
          onLayout={handleWaveformLayout}
          className='h-6 flex-row items-center gap-px'
        >
          {barHeights.map((barHeight, i) => {
            const isActive = i / BAR_COUNT <= progress
            return (
              <View
                key={i}
                className={`w-[3px] rounded-full ${isActive ? 'bg-wa-waveform-active' : isMine ? 'bg-white/40' : 'bg-wa-waveform'}`}
                style={{ height: barHeight }}
              />
            )
          })}
        </Pressable>

        <Text className={`text-[11px] ${isMine ? 'text-white/60' : 'text-wa-text-secondary'}`}>
          {duration ?? '0:00'}
        </Text>
      </View>
    </View>
  )
}

const formatSeconds = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
