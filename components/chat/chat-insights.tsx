import { useToolQuery } from '@/hooks/use-tool-query'
import { useToolFocus } from '@/hooks/use-tool-focus'
import { LoadError } from '@/components/shared/load-error'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'
import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { useMemo } from 'react'
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
  const { colors } = useAppAppearance()
  const {
    data: insights,
    error,
    isLoading,
    retry
  } = useToolQuery(chatId, getChatInsights, 'The conversation insights could not be calculated.')
  const closeRef = useToolFocus(error)

  return (
    <View className='bg-wa-bg flex-1'>
      <View className='bg-wa-header flex-row items-center border-b border-white/5 px-2 py-1'>
        <Pressable
          ref={closeRef}
          accessibilityRole='button'
          accessibilityLabel='Close chat insights'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color={colors.textPrimary} />
        </Pressable>
        <View className='ml-1'>
          <Text accessibilityRole='header' className='text-wa-text-primary text-[17px] font-medium'>
            Chat insights
          </Text>
          <Text className='text-wa-text-secondary text-[11px]'>
            Calculated locally on this device
          </Text>
        </View>
      </View>

      {error && insights ? <LoadError message={error} onRetry={retry} /> : null}
      {!insights && isLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error && !insights ? (
        <LoadError message={error} onRetry={retry} />
      ) : insights!.totalMessages === 0 ? (
        <View className='flex-1 items-center justify-center px-8'>
          <Ionicons name='stats-chart-outline' size={42} color={colors.textSecondary} />
          <Text className='text-wa-text-primary mt-4 text-center text-base'>
            Nothing to chart yet
          </Text>
          <Text className='text-wa-text-secondary mt-1 text-center text-sm'>
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
  const { colors } = useAppAppearance()
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
        <Text className='text-wa-text-secondary mt-2 text-center text-[11px]'>
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
            <Text key={label} className='text-wa-text-secondary flex-1 text-center text-[9px]'>
              {label}
            </Text>
          ))}
        </View>
        {WEEKDAY_LABELS.map((weekday, weekdayIndex) => (
          <View key={weekday} className='mt-1 flex-row items-center'>
            <Text className='text-wa-text-secondary w-9 text-[10px]'>{weekday}</Text>
            {heatmap
              .filter(cell => cell.weekday === weekdayIndex)
              .map(cell => (
                <View
                  key={cell.period}
                  accessible
                  accessibilityLabel={`${weekday}, ${PERIOD_LABELS[cell.period]}, ${number.format(cell.count)} messages`}
                  className='mx-0.5 h-7 flex-1 overflow-hidden rounded'
                >
                  <View
                    className='flex-1'
                    style={{
                      backgroundColor:
                        cell.count === 0
                          ? colors.inputBackground
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
              <Text className='text-wa-text-primary max-w-[72%] text-[13px]' numberOfLines={1}>
                {participant.name}
              </Text>
              <Text className='text-wa-text-secondary text-[12px]'>
                {number.format(participant.messageCount)}
              </Text>
            </View>
            <View className='bg-wa-input h-1.5 overflow-hidden rounded-full'>
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
                className='bg-wa-input flex-row items-center rounded-full px-3 py-2'
              >
                <Text className='text-xl'>{item.emoji}</Text>
                <Text className='text-wa-text-secondary ml-1.5 text-xs'>
                  {number.format(item.count)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className='text-wa-text-secondary mt-2 text-sm'>No emojis found.</Text>
        )}
      </Section>

      <Section title='Media'>
        <View className='mt-2 flex-row flex-wrap gap-2'>
          {(Object.keys(MEDIA_LABELS) as (keyof typeof MEDIA_LABELS)[]).map(type => {
            const count = insights.media.find(item => item.type === type)?.count ?? 0
            return (
              <View key={type} className='bg-wa-input w-[48%] rounded-lg px-3 py-3'>
                <Text className='text-wa-text-secondary text-[11px]'>{MEDIA_LABELS[type]}</Text>
                <Text className='text-wa-text-primary mt-1 text-lg font-semibold'>
                  {number.format(count)}
                </Text>
              </View>
            )
          })}
        </View>
      </Section>

      {insights.longestStreak ? (
        <Text className='text-wa-text-secondary mt-3 text-center text-[11px]'>
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
    <View className='bg-wa-header mt-4 rounded-xl px-4 py-4'>
      <Text accessibilityRole='header' className='text-wa-text-primary text-[15px] font-semibold'>
        {title}
      </Text>
      {subtitle ? (
        <Text className='text-wa-text-secondary mt-0.5 text-[10px]'>{subtitle}</Text>
      ) : null}
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
  const { colors } = useAppAppearance()
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className='bg-wa-header flex-1 rounded-xl px-3 py-4'
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text className='text-wa-text-primary mt-2 text-xl font-semibold'>{value}</Text>
      <Text className='text-wa-text-secondary mt-0.5 text-[11px]'>{label}</Text>
    </View>
  )
}

function SmallMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View className='bg-wa-input mt-2 flex-1 rounded-lg px-3 py-3'>
      <Text className='text-wa-text-secondary text-[10px]'>{label}</Text>
      <Text className='text-wa-text-primary mt-1 text-[13px] font-semibold'>{value}</Text>
      <Text className='text-wa-text-secondary mt-0.5 text-[10px]'>{detail}</Text>
    </View>
  )
}
