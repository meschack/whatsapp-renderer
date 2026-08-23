import { Text, View } from '@/src/tw'
import { getIdentityColor, getInitials } from '@/utils/participant-identity'
import { memo, type ReactNode } from 'react'

interface GeneratedAvatarProps {
  name: string
  color?: string
  size?: number
  badge?: ReactNode
}

export const GeneratedAvatar = memo(function GeneratedAvatar({
  name,
  color = getIdentityColor(name),
  size = 48,
  badge
}: GeneratedAvatarProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
      className='items-center justify-center rounded-full'
      style={{ backgroundColor: color, height: size, width: size }}
    >
      <Text
        className='font-bold text-[#111B21]'
        style={{ fontSize: Math.max(12, Math.round(size * 0.36)) }}
      >
        {getInitials(name)}
      </Text>
      {badge}
    </View>
  )
})
