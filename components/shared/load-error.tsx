import { Pressable, Text, View } from '@/src/tw'

export function LoadError({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <View className='bg-wa-header items-center gap-3 rounded-xl p-4'>
      <Text accessibilityRole='alert' className='text-wa-text-primary text-center'>
        {message}
      </Text>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Retry loading'
        onPress={onRetry}
        className='bg-wa-accent min-h-11 justify-center rounded-full px-6'
      >
        <Text className='text-wa-on-accent font-medium'>Try again</Text>
      </Pressable>
    </View>
  )
}
