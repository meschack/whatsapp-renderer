import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from '@/src/tw'
import { isValidPasscode } from '@/utils/passcode'
import type { AppLockController, AppLockState } from '@/utils/app-lock-policy'
import { useAppAppearance } from './app-appearance-provider'

export function LockGate({
  state,
  controller,
  privacyError,
  onResetAllData
}: {
  state: AppLockState
  controller: AppLockController
  privacyError: string | null
  onResetAllData?: () => Promise<void>
}) {
  const { colors, resolvedTheme } = useAppAppearance()
  const compact = useWindowDimensions().height < 500
  const [pin, setPin] = useState('')
  const [now, setNow] = useState(Date.now)
  const [showRecovery, setShowRecovery] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  useEffect(() => {
    setNow(Date.now())
    if (state.record.cooldownUntil <= Date.now()) return
    const timer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= state.record.cooldownUntil) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [state.record.cooldownUntil])
  const waiting = Math.max(0, Math.ceil((state.record.cooldownUntil - now) / 1000))
  const loading = state.status === 'loading' || (state.status === 'unlocked' && !privacyError)
  const disabled = state.busy || waiting > 0 || !isValidPasscode(pin)
  const submit = async () => {
    if (disabled) return
    const entered = pin
    setPin('')
    await controller.unlock(entered)
  }
  const error = state.error ?? privacyError
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          accessibilityViewIsModal
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='on-drag'
          style={styles.fill}
          contentContainerStyle={[styles.content, compact && styles.compactContent]}
        >
          <View style={[styles.form, compact && styles.compactForm]}>
            <View style={[styles.heading, compact && styles.compactHeading]}>
              {!compact ? (
                <>
                  <View
                    style={[
                      styles.mark,
                      { backgroundColor: colors.headerBackground, borderColor: colors.divider }
                    ]}
                  >
                    <Ionicons name='chatbubble-ellipses-outline' size={34} color={colors.accent} />
                    <View
                      style={[
                        styles.lockBadge,
                        { backgroundColor: colors.accent, borderColor: colors.background }
                      ]}
                    >
                      <Ionicons name='lock-closed' size={12} color={colors.onAccent} />
                    </View>
                  </View>
                  <Text style={[styles.brand, { color: colors.textSecondary }]}>KINSAY</Text>
                </>
              ) : null}
              <Text
                accessibilityRole='header'
                style={[styles.title, { color: colors.textPrimary }]}
              >
                {loading ? 'Opening Kinsay' : 'Unlock your chats'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {loading ? 'Just a moment…' : 'Enter your Kinsay passcode to continue.'}
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator size='large' color={colors.accent} />
            ) : (
              <>
                {state.status === 'locked' && !privacyError ? (
                  <View style={[styles.controls, compact && styles.compactControls]}>
                    <TextInput
                      accessibilityLabel='Kinsay passcode'
                      placeholder='Passcode'
                      placeholderTextColor={colors.textSecondary}
                      selectionColor={colors.accent}
                      secureTextEntry
                      keyboardType='number-pad'
                      maxLength={12}
                      value={pin}
                      onChangeText={value => setPin(value.replace(/\D/g, ''))}
                      autoComplete='off'
                      textContentType='none'
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.textPrimary,
                          borderColor: colors.divider
                        }
                      ]}
                      editable={!state.busy && waiting === 0}
                      onSubmitEditing={() => void submit()}
                    />
                    <Pressable
                      accessibilityRole='button'
                      accessibilityState={{ disabled, busy: state.busy }}
                      disabled={disabled}
                      onPress={() => void submit()}
                      style={[
                        styles.button,
                        { backgroundColor: colors.accent, opacity: disabled ? 0.5 : 1 }
                      ]}
                    >
                      {state.busy ? (
                        <ActivityIndicator size='small' color={colors.onAccent} />
                      ) : null}
                      <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>
                        {state.busy
                          ? 'Checking…'
                          : waiting
                            ? `Try again in ${waiting}s`
                            : 'Unlock Kinsay'}
                      </Text>
                    </Pressable>
                    {state.record.biometrics ? (
                      <Pressable
                        accessibilityRole='button'
                        disabled={state.busy || waiting > 0}
                        onPress={() => void controller.unlockBiometric()}
                        style={styles.secondaryButton}
                      >
                        <Ionicons name='finger-print' size={22} color={colors.accent} />
                        <Text style={[styles.link, { color: colors.accent }]}>Use biometrics</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {error ? (
                  <Text
                    accessibilityLiveRegion='polite'
                    style={[styles.message, { color: colors.error }]}
                  >
                    {error}
                  </Text>
                ) : null}
                {state.status === 'error' ? (
                  <Pressable
                    accessibilityRole='button'
                    disabled={state.busy}
                    onPress={() => void controller.initialize()}
                    style={styles.secondaryButton}
                  >
                    <Text style={[styles.link, { color: colors.accent }]}>
                      Retry secure storage
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.footer}>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>
                    Your app passcode is separate from your phone PIN.
                  </Text>
                  {onResetAllData ? (
                    <Pressable
                      accessibilityRole='button'
                      accessibilityState={{ expanded: showRecovery }}
                      disabled={state.busy}
                      onPress={() => setShowRecovery(value => !value)}
                      style={styles.secondaryButton}
                    >
                      <Text style={[styles.link, { color: colors.textSecondary }]}>
                        Forgot your passcode?
                      </Text>
                    </Pressable>
                  ) : null}
                  {showRecovery && onResetAllData ? (
                    <View style={styles.controls}>
                      <Text style={[styles.caption, { color: colors.textSecondary }]}>
                        Recovery deletes your local chats, media and bookmarks. You can import your
                        original exports again afterward.
                      </Text>
                      <Pressable
                        accessibilityRole='button'
                        disabled={state.busy}
                        onPress={() => {
                          setResetError(null)
                          void onResetAllData().catch(() =>
                            setResetError('Reset did not finish. Your archive is still locked.')
                          )
                        }}
                        style={styles.secondaryButton}
                      >
                        <Text style={[styles.link, { color: colors.error }]}>
                          Reset local archive…
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {resetError ? (
                    <Text
                      accessibilityLiveRegion='polite'
                      style={[styles.message, { color: colors.error }]}
                    >
                      {resetError}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  compactContent: { paddingVertical: 20 },
  compactForm: { gap: 16 },
  compactHeading: { gap: 8, marginBottom: 0 },
  compactControls: { gap: 10 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36
  },
  form: { width: '100%', maxWidth: 380, gap: 24 },
  heading: { alignItems: 'center', gap: 12, marginBottom: 8 },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brand: { fontFamily: 'Satoshi-Medium', fontSize: 12, letterSpacing: 3 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 28, lineHeight: 36, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  controls: { gap: 14 },
  input: {
    fontFamily: 'Satoshi',
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 20,
    textAlign: 'center'
  },
  button: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  buttonLabel: { fontFamily: 'Satoshi-Bold', fontSize: 16 },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  link: { fontFamily: 'Satoshi-Medium', fontSize: 14, textAlign: 'center' },
  footer: { gap: 8 },
  caption: { fontSize: 12, lineHeight: 19, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' }
})
