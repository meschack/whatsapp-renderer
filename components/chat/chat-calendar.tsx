import { useToolQuery } from '@/hooks/use-tool-query'
import { useToolFocus } from '@/hooks/use-tool-focus'
import { LoadError } from '@/components/shared/load-error'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'
import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { findFirstMessageOnLocalDay, getChatDays } from '@/store/message-database'
import {
  buildCalendarMonth,
  formatCalendarMonth,
  formatChatDateRange,
  monthIndexForDay,
  type ChatDateTarget
} from '@/utils/chat-calendar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface ChatCalendarProps {
  chatId: string
  onClose: () => void
  onSelect: (target: ChatDateTarget) => void
}

export function ChatCalendar({ chatId, onClose, onSelect }: ChatCalendarProps) {
  const { colors } = useAppAppearance()
  const {
    data,
    error: loadError,
    isLoading,
    retry: retryLoad
  } = useToolQuery(chatId, getChatDays, 'The conversation dates could not be loaded.')
  const days = useMemo(() => data ?? [], [data])
  const [monthIndex, setMonthIndex] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [failedDay, setFailedDay] = useState<string | null>(null)
  const generationRef = useRef(0)
  const error = loadError ?? selectionError
  const closeRef = useToolFocus(error)
  useEffect(() => {
    const generation = ++generationRef.current
    setSelectionError(null)
    setFailedDay(null)
    setSelectedDay(null)
    return () => {
      generationRef.current = generation + 1
    }
  }, [chatId])
  useEffect(() => {
    if (data) setMonthIndex(data.length > 0 ? monthIndexForDay(data.at(-1)!.dayKey) : null)
  }, [data])

  const availableDays = useMemo(() => new Map(days.map(day => [day.dayKey, day])), [days])
  const firstMonth = days.length > 0 ? monthIndexForDay(days[0].dayKey) : null
  const lastMonth = days.length > 0 ? monthIndexForDay(days.at(-1)!.dayKey) : null
  const cells = monthIndex === null ? [] : buildCalendarMonth(monthIndex)
  const dateRange = days.length > 0 ? formatChatDateRange(days[0].dayKey, days.at(-1)!.dayKey) : ''

  const selectDay = useCallback(
    async (dayKey: string) => {
      if (selectedDay) return
      setSelectedDay(dayKey)
      setSelectionError(null)
      setFailedDay(null)
      const generation = generationRef.current
      try {
        const target = await findFirstMessageOnLocalDay(chatId, dayKey)
        if (generation !== generationRef.current) return
        if (target) onSelect(target)
        else {
          setFailedDay(dayKey)
          setSelectionError('No messages were found on that day.')
        }
      } catch {
        if (generation !== generationRef.current) return
        setFailedDay(dayKey)
        setSelectionError('That date could not be opened.')
      } finally {
        if (generation === generationRef.current) setSelectedDay(null)
      }
    },
    [chatId, onSelect, selectedDay]
  )

  return (
    <View className='bg-wa-bg absolute inset-0'>
      <View className='bg-wa-header h-15 flex-row items-center px-2'>
        <Pressable
          ref={closeRef}
          accessibilityRole='button'
          accessibilityLabel='Close calendar'
          className='size-11 items-center justify-center'
          onPress={onClose}
        >
          <Ionicons name='close' size={26} color={colors.textPrimary} />
        </Pressable>
        <View className='ml-1 flex-1'>
          <Text
            accessibilityRole='header'
            className='text-wa-text-primary text-[17px] font-semibold'
          >
            Jump to date
          </Text>
          {dateRange ? (
            <Text className='text-wa-text-secondary text-[11px]'>{dateRange}</Text>
          ) : null}
        </View>
      </View>

      {isLoading && !data ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : loadError && !data ? (
        <LoadError message={loadError} onRetry={retryLoad} />
      ) : days.length === 0 ? (
        <View className='flex-1 items-center justify-center px-8'>
          <Ionicons name='calendar-outline' size={42} color={colors.textSecondary} />
          <Text className='text-wa-text-primary mt-4 text-center text-base'>No dated messages</Text>
          <Text className='text-wa-text-secondary mt-1 text-center text-sm'>
            This conversation has no dates available to jump to.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 28 }}
        >
          {loadError ? <LoadError message={loadError} onRetry={retryLoad} /> : null}
          <View className='mb-4 flex-row items-center justify-between'>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Previous month'
              accessibilityState={{ disabled: monthIndex === firstMonth }}
              className='size-11 items-center justify-center rounded-full'
              disabled={monthIndex === firstMonth}
              onPress={() => setMonthIndex(current => (current === null ? current : current - 1))}
            >
              <Ionicons
                name='chevron-back'
                size={24}
                color={monthIndex === firstMonth ? colors.textSecondary : colors.textPrimary}
              />
            </Pressable>
            <Text className='text-wa-text-primary text-base font-semibold'>
              {monthIndex === null ? '' : formatCalendarMonth(monthIndex)}
            </Text>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Next month'
              accessibilityState={{ disabled: monthIndex === lastMonth }}
              className='size-11 items-center justify-center rounded-full'
              disabled={monthIndex === lastMonth}
              onPress={() => setMonthIndex(current => (current === null ? current : current + 1))}
            >
              <Ionicons
                name='chevron-forward'
                size={24}
                color={monthIndex === lastMonth ? colors.textSecondary : colors.textPrimary}
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
                      <ActivityIndicator size='small' color={colors.accent} />
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

          <View className='bg-wa-header mt-5 rounded-xl px-4 py-3'>
            <Text className='text-wa-text-secondary text-center text-xs'>
              Dates without messages are disabled. A selected date opens its first message.
            </Text>
          </View>
          {selectionError ? (
            <LoadError
              message={selectionError}
              onRetry={() => {
                if (failedDay) void selectDay(failedDay)
              }}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
