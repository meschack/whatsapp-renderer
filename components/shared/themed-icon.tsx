import { Ionicons as NativeIonicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'
import { themeLiteralColor } from '@/utils/legacy-theme'

function Icon(props: ComponentProps<typeof NativeIonicons>) {
  const { colors } = useAppAppearance()
  return (
    <NativeIonicons
      {...props}
      color={typeof props.color === 'string' ? themeLiteralColor(props.color, colors) : props.color}
    />
  )
}
export const ThemedIonicons = Object.assign(Icon, { glyphMap: NativeIonicons.glyphMap })
