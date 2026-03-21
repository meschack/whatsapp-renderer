import { Image as RNImage } from 'expo-image'
import React from 'react'
import { StyleSheet } from 'react-native'
import { useCssElement } from 'react-native-css'
import Animated from 'react-native-reanimated'

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage)

type BaseImageProps = React.ComponentProps<typeof AnimatedExpoImage>

function CSSImage(props: BaseImageProps) {
  // @ts-expect-error: Remap objectFit style to contentFit property
  const { objectFit, objectPosition, ...style } = StyleSheet.flatten(props.style) || {}

  return (
    <AnimatedExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={typeof props.source === 'string' ? { uri: props.source } : props.source}
      // @ts-expect-error: Style is remapped above
      style={style}
    />
  )
}

export type ImageProps = BaseImageProps & { className?: string }

export const Image = (props: ImageProps): React.ReactElement => {
  return useCssElement(CSSImage, props, {
    className: 'style'
  }) as React.ReactElement
}

Image.displayName = 'CSS(Image)'
