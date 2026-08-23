import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { findFirstMessageOnLocalDay, getChatDays } from '@/store/message-database'
import {
  buildCalendarMonth,
  formatCalendarMonth,
  formatChatDateRange,
  monthIndexForDay,
  type ChatDateTarget,
  type ChatDay
} from '@/utils/chat-calendar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface ChatCalendarProps {
  chatId: string
  onClose: () => void
  onSelect: (target: ChatDateTarget) => void
}

export function ChatCalendar({ chatId, onClose, onSelect }: ChatCalendarProps) {
  const [days, setDays] = useState<ChatDay[]>([])
  const [monthIndex, setMonthIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    void getChatDays(chatId).then(
      loadedDays => {
        if (!active) return
        setDays(loadedDays)
        setMonthIndex(loadedDays.length > 0 ? monthIndexForDay(loadedDays.at(-1)!.dayKey) : null)
        setIsLoading(false)
      },
      loadError => {
        if (!active) return
        console.error('Failed to load chat calendar', loadError)
        setError('The conversation dates could not be loaded.')
        setIsLoading(false)
      }
    )

    return () => {
      active = false
    }
  }, [chatId])

  const availableDays = useMemo(() => new Map(days.map(day => [day.dayKey, day])), [days])
  const firstMonth = days.length > 0 ? monthIndexForDay(days[0].dayKey) : null
  const lastMonth = days.length > 0 ? monthIndexForDay(days.at(-1)!.dayKey) : null
  const cells = monthIndex === null ? [] : buildCalendarMonth(monthIndex)
  const dateRange = days.length > 0 ? formatChatDateRange(days[0].dayKey, days.at(-1)!.dayKey) : ''

  const selectDay = useCallback(
    async (dayKey: string) => {
      if (selectedDay) return
      setSelectedDay(dayKey)
      setError(null)
      try {
        const target = await findFirstMessageOnLocalDay(chatId, dayKey)
        if (target) onSelect(target)
        else setError('No messages were found on that day.')
      } catch (selectionError) {
        console.error('Failed to jump to chat date', selectionError)
        setError('That date could not be opened.')
      } finally {
        setSelectedDay(null)
      }
    },
    [chatId, onSelect, selectedDay]
  )

  return (
    <View className='bg-wa-bg absolute inset-0'>
      <View className='bg-wa-header h-15 flex-row items-center px-2'>
        <Pressable
          accessibilityLabel='Close calendar'
          className='size-11 items-center justify-center'
          onPress={onClose}
        >
          <Ionicons name='close' size={26} color='#E9EDEF' />
        </Pressable>
        <View className='ml-1 flex-1'>
          <Text className='text-wa-text-primary text-[17px] font-semibold'>Jump to date</Text>
          {dateRange ? (
            <Text className='text-wa-text-secondary text-[11px]'>{dateRange}</Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color='#00A884' />
        </View>
      ) : days.length === 0 ? (
        <View className='flex-1 items-center justify-center px-8'>
          <Ionicons name='calendar-outline' size={42} color='#8696A0' />
          <Text className='text-wa-text-primary mt-4 text-center text-base'>No dated messages</Text>
          <Text className='text-wa-text-secondary mt-1 text-center text-sm'>
            This conversation has no dates available to jump to.
          </Text>
        </View>
      ) : (
        <View className='px-4 pt-5'>
          <View className='mb-4 flex-row items-center justify-between'>
            <Pressable
              accessibilityLabel='Previous month'
              accessibilityState={{ disabled: monthIndex === firstMonth }}
              className='size-11 items-center justify-center rounded-full'
              disabled={monthIndex === firstMonth}
              onPress={() => setMonthIndex(current => (current === null ? current : current - 1))}
            >
              <Ionicons
                name='chevron-back'
                size={24}
                color={monthIndex === firstMonth ? '#3B4A54' : '#E9EDEF'}
              />
            </Pressable>
            <Text className='text-wa-text-primary text-base font-semibold'>
              {monthIndex === null ? '' : formatCalendarMonth(monthIndex)}
            </Text>
            <Pressable
              accessibilityLabel='Next month'
              accessibilityState={{ disabled: monthIndex === lastMonth }}
              className='size-11 items-center justify-center rounded-full'
              disabled={monthIndex === lastMonth}
              onPress={() => setMonthIndex(current => (current === null ? current : current + 1))}
            >
              <Ionicons
                name='chevron-forward'
                size={24}
                color={monthIndex === lastMonth ? '#3B4A54' : '#E9EDEF'}
              />
            </Pressable>
          </View>

          <View className='flex-row'>
            {WEEKDAYS.map((weekday, index) => (
              <View key={`${weekday}-${index}`} className='w-[14.2857%] items-center py-2'>
                <Text className='text-wa-text-secondary text-xs font-medium'>{weekday}</Text>
              </View>
            ))}
          </View>

          <View className='flex-row flex-wrap'>
            {cells.map((cell, index) => {
              if (!cell)
                return <View key={`empty-${index}`} className='aspect-square w-[14.2857%]' />
              const day = availableDays.get(cell.dayKey)
              const isSelecting = selectedDay === cell.dayKey
              return (
                <View
                  key={cell.dayKey}
                  className='aspect-square w-[14.2857%] items-center justify-center'
                >
                  <Pressable
                    accessibilityLabel={
                      day
                        ? `${cell.dayKey}, ${day.messageCount} messages`
                        : `${cell.dayKey}, no messages`
                    }
                    accessibilityRole='button'
                    accessibilityState={{ disabled: !day }}
                    className={`size-10 items-center justify-center rounded-full ${
                      day ? 'bg-[#103F36]' : ''
                    }`}
                    disabled={!day || Boolean(selectedDay)}
                    onPress={() => void selectDay(cell.dayKey)}
                  >
                    {isSelecting ? (
                      <ActivityIndicator size='small' color='#00A884' />
                    ) : (
                      <Text className={day ? 'font-semibold text-[#00A884]' : 'text-[#3B4A54]'}>
                        {cell.dayOfMonth}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )
            })}
          </View>

          <View className='mt-5 rounded-xl bg-[#111B21] px-4 py-3'>
            <Text className='text-wa-text-secondary text-center text-xs'>
              Dates without messages are disabled. A selected date opens its first message.
            </Text>
          </View>
          {error ? <Text className='mt-4 text-center text-sm text-[#F15C6D]'>{error}</Text> : null}
        </View>
      )}
    </View>
  )
}
