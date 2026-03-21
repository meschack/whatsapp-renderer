import { View, Text } from '@/src/tw'

interface SystemMessageProps {
  text: string | null
}

export function SystemMessage({ text }: SystemMessageProps) {
  if (!text) return null

  return (
    <View className='items-center py-1 px-4'>
      <View className='bg-wa-header/80 rounded-lg px-3 py-1.5 max-w-[85%]'>
        <Text className='text-wa-text-secondary text-[11px] text-center leading-4'>
          {text}
        </Text>
      </View>
    </View>
  )
}
