import { View, Text } from '@/src/tw'
import { memo } from 'react'
import { useChatAppearance } from './chat-appearance-context'

interface SystemMessageProps {
  text: string | null
}

export const SystemMessage = memo(function SystemMessage({ text }: SystemMessageProps) {
  const { textScale } = useChatAppearance()
  if (!text) return null

  return (
    <View className='items-center px-4 py-1'>
      <View className='bg-wa-header/80 max-w-[85%] rounded-lg px-3 py-1.5'>
        <Text
          className='text-wa-text-secondary text-center'
          style={{ fontSize: 11 * textScale, lineHeight: 16 * textScale }}
        >
          {text}
        </Text>
      </View>
    </View>
  )
})
