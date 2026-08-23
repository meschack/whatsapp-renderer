import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { getChatInsights } from '@/store/chat-insights-database'
import {
  buildHeatmapPeriods,
  formatHour,
  getBusiestHour,
  getBusiestWeekday,
  PERIOD_LABELS,
  WEEKDAY_LABELS,
  type ChatInsights as ChatInsightsData
} from '@/utils/chat-insights'

const MEDIA_LABELS = {
  image: 'Photos',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents'
} as const

interface ChatInsightsProps {
  chatId: string
  onClose(): void
}

export function ChatInsights({ chatId, onClose }: ChatInsightsProps) {
  const [insights, setInsights] = useState<ChatInsightsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setInsights(null)
    setError(null)
    void getChatInsights(chatId).then(
      result => {
        if (active) setInsights(result)
      },
      loadError => {
        if (!active) return
        console.error('Failed to load chat insights', loadError)
        setError('The conversation insights could not be calculated.')
      }
    )
    return () => {
      active = false
    }
  }, [chatId])

  return (
    <View className='flex-1 bg-[#0B141A]'>
      <View className='flex-row items-center border-b border-white/5 bg-[#202C33] px-2 py-1'>
        <Pressable
          accessibilityLabel='Close chat insights'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <View className='ml-1'>
          <Text className='text-[17px] font-medium text-[#E9EDEF]'>Chat insights</Text>
          <Text className='text-[11px] text-[#8696A0]'>Calculated locally on this device</Text>
        </View>
      </View>

      {!insights && !error ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color='#00A884' />
        </View>
      ) : error ? (
        <View className='flex-1 items-center justify-center px-8'>
          <Ionicons name='stats-chart-outline' size={42} color='#667781' />
          <Text className='mt-4 text-center text-sm text-[#F15C6D]'>{error}</Text>
        </View>
      ) : insights!.totalMessages === 0 ? (
        <View className='flex-1 items-center justify-center px-8'>
          <Ionicons name='stats-chart-outline' size={42} color='#667781' />
          <Text className='mt-4 text-center text-base text-[#E9EDEF]'>Nothing to chart yet</Text>
          <Text className='mt-1 text-center text-sm text-[#8696A0]'>
            This chat has no participant messages.
          </Text>
        </View>
      ) : (
        <InsightsContent insights={insights!} />
      )}
    </View>
  )
}

function InsightsContent({ insights }: { insights: ChatInsightsData }) {
  const number = useMemo(() => new Intl.NumberFormat(), [])
  const busiestWeekday = getBusiestWeekday(insights.activity)
  const busiestHour = getBusiestHour(insights.activity)
  const heatmap = buildHeatmapPeriods(insights.activity)
  const maxHeat = Math.max(1, ...heatmap.map(cell => cell.count))
  const largestParticipant = Math.max(1, ...insights.participants.map(item => item.messageCount))
  const rangeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    []
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 36 }}>
      <View className='flex-row gap-2'>
        <MetricCard
          label='Messages'
          value={number.format(insights.totalMessages)}
          icon='chatbubbles-outline'
        />
        <MetricCard
          label='Longest streak'
          value={`${insights.longestStreak?.dayCount ?? 0} days`}
          icon='flame-outline'
        />
      </View>

      {insights.firstMessageAt !== null && insights.lastMessageAt !== null ? (
        <Text className='mt-2 text-center text-[11px] text-[#667781]'>
          {rangeFormatter.format(new Date(insights.firstMessageAt))} –{' '}
          {rangeFormatter.format(new Date(insights.lastMessageAt))}
        </Text>
      ) : null}

      <Section title='Busiest periods'>
        <View className='flex-row gap-2'>
          <SmallMetric
            label='Day of week'
            value={busiestWeekday ? WEEKDAY_LABELS[busiestWeekday.weekday] : '—'}
            detail={busiestWeekday ? `${number.format(busiestWeekday.count)} messages` : ''}
          />
          <SmallMetric
            label='Hour'
            value={busiestHour ? formatHour(busiestHour.hour) : '—'}
            detail={busiestHour ? `${number.format(busiestHour.count)} messages` : ''}
          />
        </View>
      </Section>

      <Section title='Activity heatmap' subtitle='Local time · darker means busier'>
        <View className='mt-2 flex-row pl-9'>
          {PERIOD_LABELS.map(label => (
            <Text key={label} className='flex-1 text-center text-[9px] text-[#667781]'>
              {label}
            </Text>
          ))}
        </View>
        {WEEKDAY_LABELS.map((weekday, weekdayIndex) => (
          <View key={weekday} className='mt-1 flex-row items-center'>
            <Text className='w-9 text-[10px] text-[#8696A0]'>{weekday}</Text>
            {heatmap
              .filter(cell => cell.weekday === weekdayIndex)
              .map(cell => (
                <View key={cell.period} className='mx-0.5 h-7 flex-1 overflow-hidden rounded'>
                  <View
                    className='flex-1'
                    style={{
                      backgroundColor:
                        cell.count === 0
                          ? '#182229'
                          : `rgba(0, 168, 132, ${0.2 + 0.8 * (cell.count / maxHeat)})`
                    }}
                  />
                </View>
              ))}
          </View>
        ))}
      </Section>

      <Section title='Participants'>
        {insights.participants.map(participant => (
          <View key={participant.name} className='mt-3'>
            <View className='mb-1 flex-row justify-between'>
              <Text className='max-w-[72%] text-[13px] text-[#D1D7DB]' numberOfLines={1}>
                {participant.name}
              </Text>
              <Text className='text-[12px] text-[#8696A0]'>
                {number.format(participant.messageCount)}
              </Text>
            </View>
            <View className='h-1.5 overflow-hidden rounded-full bg-[#182229]'>
              <View
                className='h-full rounded-full bg-[#00A884]'
                style={{ width: `${(participant.messageCount / largestParticipant) * 100}%` }}
              />
            </View>
          </View>
        ))}
      </Section>

      <Section title='Top emojis'>
        {insights.topEmojis.length > 0 ? (
          <View className='mt-2 flex-row flex-wrap gap-2'>
            {insights.topEmojis.map(item => (
              <View
                key={item.emoji}
                className='flex-row items-center rounded-full bg-[#182229] px-3 py-2'
              >
                <Text className='text-xl'>{item.emoji}</Text>
                <Text className='ml-1.5 text-xs text-[#AEBAC1]'>{number.format(item.count)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className='mt-2 text-sm text-[#667781]'>No emojis found.</Text>
        )}
      </Section>

      <Section title='Media'>
        <View className='mt-2 flex-row flex-wrap gap-2'>
          {(Object.keys(MEDIA_LABELS) as (keyof typeof MEDIA_LABELS)[]).map(type => {
            const count = insights.media.find(item => item.type === type)?.count ?? 0
            return (
              <View key={type} className='w-[48%] rounded-lg bg-[#182229] px-3 py-3'>
                <Text className='text-[11px] text-[#8696A0]'>{MEDIA_LABELS[type]}</Text>
                <Text className='mt-1 text-lg font-semibold text-[#E9EDEF]'>
                  {number.format(count)}
                </Text>
              </View>
            )
          })}
        </View>
      </Section>

      {insights.longestStreak ? (
        <Text className='mt-3 text-center text-[11px] text-[#667781]'>
          Longest streak means consecutive local calendar days with at least one participant
          message: {insights.longestStreak.startDay} – {insights.longestStreak.endDay}.
        </Text>
      ) : null}
    </ScrollView>
  )
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <View className='mt-4 rounded-xl bg-[#111B21] px-4 py-4'>
      <Text className='text-[15px] font-semibold text-[#E9EDEF]'>{title}</Text>
      {subtitle ? <Text className='mt-0.5 text-[10px] text-[#667781]'>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

function MetricCard({
  label,
  value,
  icon
}: {
  label: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View className='flex-1 rounded-xl bg-[#111B21] px-3 py-4'>
      <Ionicons name={icon} size={20} color='#00A884' />
      <Text className='mt-2 text-xl font-semibold text-[#E9EDEF]'>{value}</Text>
      <Text className='mt-0.5 text-[11px] text-[#8696A0]'>{label}</Text>
    </View>
  )
}

function SmallMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View className='mt-2 flex-1 rounded-lg bg-[#182229] px-3 py-3'>
      <Text className='text-[10px] text-[#667781]'>{label}</Text>
      <Text className='mt-1 text-[13px] font-semibold text-[#E9EDEF]'>{value}</Text>
      <Text className='mt-0.5 text-[10px] text-[#8696A0]'>{detail}</Text>
    </View>
  )
}
