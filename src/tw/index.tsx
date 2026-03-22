import { useCssElement, useNativeVariable as useFunctionalVariable } from 'react-native-css'

import { Link as RouterLink } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator as RNActivityIndicator,
  FlatList as RNFlatList,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  View as RNView
} from 'react-native'
import Animated from 'react-native-reanimated'

export const Link = (props: React.ComponentProps<typeof RouterLink> & { className?: string }) => {
  // @ts-ignore: Complex union type from useCssElement
  return useCssElement(RouterLink, props, { className: 'style' })
}

export const useCSSVariable =
  process.env.EXPO_OS !== 'web' ? useFunctionalVariable : (variable: string) => `var(${variable})`

export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string
}

export const View = (props: ViewProps) => {
  return useCssElement(RNView, props, { className: 'style' })
}
View.displayName = 'CSS(View)'

export const Text = (props: React.ComponentProps<typeof RNText> & { className?: string }) => {
  return useCssElement(RNText, props, { className: 'style' })
}
Text.displayName = 'CSS(Text)'

export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string
    contentContainerClassName?: string
  }
) => {
  // @ts-ignore: Complex union type from useCssElement
  return useCssElement(RNScrollView, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle'
  })
}
ScrollView.displayName = 'CSS(ScrollView)'

export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  return useCssElement(RNPressable, props, { className: 'style' })
}
Pressable.displayName = 'CSS(Pressable)'

export const TouchableOpacity = (
  props: React.ComponentProps<typeof RNTouchableOpacity> & {
    className?: string
  }
) => {
  return useCssElement(RNTouchableOpacity, props, { className: 'style' })
}
TouchableOpacity.displayName = 'CSS(TouchableOpacity)'

export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return useCssElement(RNTextInput, props, { className: 'style' })
}
TextInput.displayName = 'CSS(TextInput)'

export const AnimatedScrollView = (
  props: React.ComponentProps<typeof Animated.ScrollView> & {
    className?: string
    contentContainerClassName?: string
  }
) => {
  // @ts-ignore: Complex union type from useCssElement + Animated
  return useCssElement(Animated.ScrollView, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle'
  })
}

export { RNActivityIndicator as ActivityIndicator, RNFlatList as FlatList }
