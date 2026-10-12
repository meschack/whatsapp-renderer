import { useEffect, useState } from 'react'
import { Switch } from 'react-native'
import { Pressable, Text, TextInput, View } from '@/src/tw'
import { useAppLock } from './app-lock-provider'
import { useAppAppearance } from './app-appearance-provider'
export function AppLockSettings() {
  const { state, controller } = useAppLock()
  const { colors } = useAppAppearance()
  const enabled = !!state.record.verifier
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [biometrics, setBiometrics] = useState(state.record.biometrics)
  const [hideAppPreview, setHideAppPreview] = useState(state.record.hideAppPreview)
  const [differentPhonePin, setDifferentPhonePin] = useState(false)
  useEffect(() => {
    setBiometrics(state.record.biometrics)
    setHideAppPreview(state.record.hideAppPreview)
  }, [state.record.biometrics, state.record.hideAppPreview])
  const [notice, setNotice] = useState<string | null>(null)
  const run = async (operation: () => Promise<boolean>) => {
    setNotice(null)
    if (await operation()) {
      setCurrent('')
      setPin('')
      setConfirmation('')
      setNotice('Lock settings saved.')
    }
  }
  const field = (label: string, value: string, change: (value: string) => void) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      secureTextEntry
      keyboardType='number-pad'
      maxLength={12}
      value={value}
      onChangeText={change}
      editable={!state.busy}
      autoComplete='off'
      textContentType='none'
      className='bg-wa-input text-wa-text-primary min-h-12 rounded-xl px-4'
    />
  )
  return (
    <View className='bg-wa-header gap-3 rounded-2xl p-4'>
      <Text className='text-wa-text-primary text-lg font-semibold'>Kinsay passcode lock</Text>
      <Text className='text-wa-text-secondary text-sm'>
        Choose your own 6–12 digit passcode, different from your phone PIN. Kinsay cannot read or
        compare your phone PIN.
      </Text>
      <Text className='text-wa-text-secondary text-xs'>
        The lock protects access inside Kinsay; it does not encrypt imported files. Forgot your
        passcode? Resetting deletes the archive, then you can import exports again.
      </Text>
      {enabled ? field('Current Kinsay passcode', current, setCurrent) : null}
      {field(enabled ? 'New Kinsay passcode' : 'Choose Kinsay passcode', pin, setPin)}
      {field('Confirm Kinsay passcode', confirmation, setConfirmation)}
      <View className='flex-row items-center gap-3'>
        <Text className='text-wa-text-primary flex-1 text-sm'>
          I chose a passcode different from my phone PIN
        </Text>
        <Switch
          accessibilityLabel='Confirm Kinsay passcode differs from phone PIN'
          value={differentPhonePin}
          onValueChange={setDifferentPhonePin}
          disabled={state.busy}
          trackColor={{ true: colors.accent }}
        />
      </View>
      <Pressable
        accessibilityRole='button'
        disabled={state.busy || !differentPhonePin}
        onPress={() =>
          void run(() =>
            enabled
              ? controller.change(current, pin, confirmation)
              : controller.setup(pin, confirmation)
          )
        }
        className='bg-wa-accent min-h-12 items-center justify-center rounded-xl'
      >
        <Text className='text-wa-on-accent font-semibold'>
          {state.busy ? 'Saving…' : enabled ? 'Change passcode' : 'Enable passcode lock'}
        </Text>
      </Pressable>
      {enabled ? (
        <>
          <View className='flex-row items-center gap-3'>
            <Text className='text-wa-text-primary flex-1'>Biometric unlock</Text>
            <Switch
              accessibilityLabel='Enable biometric convenience without phone PIN fallback'
              value={biometrics}
              onValueChange={setBiometrics}
              disabled={state.busy}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text className='text-wa-text-secondary text-xs'>
            Optional convenience. Phone PIN fallback is disabled.
          </Text>
          <View className='flex-row items-center gap-3'>
            <Text className='text-wa-text-primary flex-1'>Hide app switcher preview</Text>
            <Switch
              accessibilityLabel='Hide app switcher preview'
              value={hideAppPreview}
              onValueChange={setHideAppPreview}
              disabled={state.busy}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text className='text-wa-text-secondary text-xs'>
            Android also blocks screenshots and screen recording.
          </Text>
          <Pressable
            accessibilityRole='button'
            disabled={state.busy}
            onPress={() =>
              void run(() => controller.configure(current, { biometrics, hideAppPreview }))
            }
            className='min-h-11 items-center justify-center'
          >
            <Text className='text-wa-accent'>Save privacy options with current passcode</Text>
          </Pressable>
          <View className='flex-row gap-4'>
            <Pressable
              accessibilityRole='button'
              disabled={state.busy}
              onPress={() => controller.lock()}
              className='min-h-11 flex-1 items-center justify-center'
            >
              <Text className='text-wa-accent'>Lock now</Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              disabled={state.busy}
              onPress={() => void run(() => controller.disable(current))}
              className='min-h-11 flex-1 items-center justify-center'
            >
              <Text className='text-wa-error'>Disable lock</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {state.error ? <Text className='text-wa-error'>{state.error}</Text> : null}
      {notice ? <Text className='text-wa-text-secondary'>{notice}</Text> : null}
    </View>
  )
}
