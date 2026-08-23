import { View, Text } from '@/src/tw'
import { memo } from 'react'

interface DateSeparatorProps {
  date: string
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <View className='items-center px-4 py-2.5'>
      <View className='rounded-lg bg-[#182229]/95 px-3 py-1'>
        <Text className='text-[11.5px] font-medium text-[#E9EDEF]'>{date}</Text>
      </View>
    </View>
  )
})
