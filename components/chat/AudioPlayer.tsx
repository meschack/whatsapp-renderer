import { Pressable, Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useCallback, useMemo } from 'react'

interface AudioPlayerProps {
  uri: string | null
  isMine: boolean
  duration?: string
}

const generateBarHeights = (count: number): number[] => {
  const heights: number[] = []
  for (let i = 0; i < count; i++) {
    heights.push(Math.sin(i * 0.7) * 8 + 12)
  }
  return heights
}

export const AudioPlayer = ({ uri, isMine, duration }: AudioPlayerProps) => {
  if (!uri) {
    return <AudioPlaceholder isMine={isMine} duration={duration} />
  }
  return <AudioPlayerActive uri={uri} isMine={isMine} duration={duration} />
}

const AudioPlaceholder = ({ isMine, duration }: { isMine: boolean; duration?: string }) => {
  const barHeights = useMemo(() => generateBarHeights(30), [])

  return (
    <AudioPlayerUI
      barHeights={barHeights}
      isMine={isMine}
      duration={duration}
      progress={0}
      isPlaying={false}
      onPlayPause={() => {}}
    />
  )
}

interface AudioPlayerActiveProps {
  uri: string
  isMine: boolean
  duration?: string
}

const AudioPlayerActive = ({ uri, isMine, duration }: AudioPlayerActiveProps) => {
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)
  const barHeights = useMemo(() => generateBarHeights(30), [])

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause()
    } else {
      player.play()
    }
  }, [status.playing, player])

  const displayDuration =
    status.duration > 0 ? formatSeconds(status.duration) : (duration ?? '0:00')

  return (
    <AudioPlayerUI
      barHeights={barHeights}
      isMine={isMine}
      duration={displayDuration}
      progress={progress}
      isPlaying={status.playing}
      onPlayPause={handlePlayPause}
    />
  )
}

interface AudioPlayerUIProps {
  barHeights: number[]
  isMine: boolean
  duration?: string
  progress: number
  isPlaying: boolean
  onPlayPause: () => void
}

const AudioPlayerUI = ({
  barHeights,
  isMine,
  duration,
  progress,
  isPlaying,
  onPlayPause
}: AudioPlayerUIProps) => {
  return (
    <View className='min-w-[200px] flex-row items-center gap-2 py-1'>
      <View className='bg-wa-accent-light/30 h-10 w-10 items-center justify-center rounded-full'>
        <Ionicons name='person' size={20} color='#06CF9C' />
      </View>

      <Pressable onPress={onPlayPause} className='p-1'>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={28}
          color={isMine ? '#E9EDEF' : '#8696A0'}
        />
      </Pressable>

      <View className='flex-1 gap-1'>
        <View className='h-6 flex-row items-center gap-px'>
          {barHeights.map((barHeight, i) => {
            const isActive = i / 30 <= progress
            return (
              <View
                key={i}
                className={`w-[3px] rounded-full ${isActive ? 'bg-wa-waveform-active' : isMine ? 'bg-white/40' : 'bg-wa-waveform'}`}
                style={{ height: barHeight }}
              />
            )
          })}
        </View>

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
