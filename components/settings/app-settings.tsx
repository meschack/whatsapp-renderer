import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { Modal } from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, ScrollView, Text, View } from '@/src/tw'
import { AppAppearanceSettings } from './app-appearance-settings'
import { useAppAppearance } from './app-appearance-provider'
import { AppLockSettings } from './app-lock-settings'

export function AppSettingsButton() {
  const [open, setOpen] = useState(false)
  const { colors } = useAppAppearance()
  return (
    <>
      <Pressable
        testID='app-settings-button'
        accessibilityRole='button'
        accessibilityLabel='App settings'
        className='size-11 items-center justify-center'
        onPress={() => setOpen(true)}
      >
        <Ionicons name='settings-outline' size={23} color={colors.textPrimary} />
      </Pressable>
      <Modal visible={open} animationType='slide' onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View className='bg-wa-header flex-row items-center justify-between px-4 py-2'>
            <Text accessibilityRole='header' className='text-wa-text-primary text-lg font-medium'>
              Settings
            </Text>
            <Pressable
              testID='app-settings-close'
              accessibilityRole='button'
              accessibilityLabel='Close settings'
              className='size-11 items-center justify-center'
              onPress={() => setOpen(false)}
            >
              <Ionicons name='close' size={25} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
              padding: 20,
              gap: 24
            }}
          >
            <AppAppearanceSettings />
            <AppLockSettings />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}
