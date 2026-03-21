import { View, Text } from '@/src/tw'

interface DateSeparatorProps {
  date: string
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <View className='items-center py-2 px-4'>
      <View className='bg-wa-header rounded-lg px-3 py-1.5'>
        <Text className='text-wa-text-secondary text-xs font-medium'>{date}</Text>
      </View>
    </View>
  )
}
