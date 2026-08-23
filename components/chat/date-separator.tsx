import { View, Text } from '@/src/tw'
import { memo } from 'react'
import { useChatAppearance } from './chat-appearance-context'

interface DateSeparatorProps {
  date: string
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  const { textScale } = useChatAppearance()
  return (
    <View className='items-center px-4 py-2.5'>
      <View className='rounded-lg bg-[#182229]/95 px-3 py-1'>
        <Text className='font-medium text-[#E9EDEF]' style={{ fontSize: 11.5 * textScale }}>
          {date}
        </Text>
      </View>
    </View>
  )
})
