import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren
} from 'react'
import { AppState, Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as ScreenCapture from 'expo-screen-capture'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from '@/src/tw'
import {
  clearAppLockAfterArchiveReset,
  getAppLockSettings,
  makeAppPasscodeVerifier,
  saveAppLockSettings
} from '@/store/app-lock-settings'
import {
  createAppLockController,
  type AppLockController,
  type AppLockState
} from '@/utils/app-lock-policy'
import { verifyPasscode } from '@/utils/passcode'
import { useAppAppearance } from './app-appearance-provider'

interface LockContext {
  state: AppLockState
  controller: AppLockController
  privacyError: string | null
}
const AppLockContext = createContext<LockContext | null>(null)
export function useAppLock() {
  const value = useContext(AppLockContext)
  if (!value) throw new Error('AppLockProvider must surround lock settings')
  return value
}
/** Children are not mounted until lock credentials have been read and access granted. */
export function AppLockProvider({
  children,
  onResetAllData
}: PropsWithChildren<{ onResetAllData?: () => Promise<void> }>) {
  const { colors, setMode, setDefaultTextScale } = useAppAppearance()
  const [state, setState] = useState<AppLockState | null>(null)
  const [privacyReady, setPrivacyReady] = useState(false)
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const biometricPromptActive = useRef(false)
  const recoveryActive = useRef(false)
  const [recovering, setRecovering] = useState(false)
  const privacyQueue = useRef(Promise.resolve())
  const [controller] = useState(() =>
    createAppLockController(
      {
        load: getAppLockSettings,
        save: saveAppLockSettings,
        create: makeAppPasscodeVerifier,
        verify: verifyPasscode,
        now: Date.now,
        async biometric() {
          if (
            !(await LocalAuthentication.hasHardwareAsync()) ||
            !(await LocalAuthentication.isEnrolledAsync())
          )
            return false
          biometricPromptActive.current = true
          try {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock Kinsay',
              disableDeviceFallback: true,
              fallbackLabel: '',
              biometricsSecurityLevel: 'strong',
              cancelLabel: 'Use Kinsay passcode'
            })
            return result.success
          } finally {
            biometricPromptActive.current = false
          }
        }
      },
      setState
    )
  )
  useEffect(() => {
    controller.setForeground(AppState.currentState === 'active')
    void controller.initialize()
    const subscription = AppState.addEventListener('change', next => {
      // Only our own biometric dialog may keep an inactive transition open.
      // A real background always revokes pending unlocks.
      if (next === 'background' || (next === 'inactive' && !biometricPromptActive.current))
        controller.setForeground(false)
      else if (next === 'active') controller.setForeground(true)
    })
    return () => {
      subscription.remove()
      controller.setForeground(false)
    }
  }, [controller])
  const hideAppPreview = state?.record.hideAppPreview
  useEffect(() => {
    if (hideAppPreview === undefined) return
    let disposed = false
    setPrivacyReady(false)
    privacyQueue.current = privacyQueue.current
      .catch(() => {})
      .then(async () => {
        if (Platform.OS === 'android') {
          if (hideAppPreview) await ScreenCapture.preventScreenCaptureAsync('kinsay-lock')
          else await ScreenCapture.allowScreenCaptureAsync('kinsay-lock')
        } else if (Platform.OS === 'ios') {
          if (hideAppPreview) await ScreenCapture.enableAppSwitcherProtectionAsync(1)
          else await ScreenCapture.disableAppSwitcherProtectionAsync()
        }
      })
      .then(() => {
        if (!disposed) {
          setPrivacyReady(true)
          setPrivacyError(null)
        }
      })
      .catch(() => {
        if (!disposed)
          setPrivacyError('App preview protection could not start. Reopen Kinsay to retry.')
      })
    return () => {
      disposed = true
    }
  }, [hideAppPreview])
  const recover = useCallback(async () => {
    if (!onResetAllData || controller.getState().busy || recoveryActive.current) return
    recoveryActive.current = true
    setRecovering(true)
    controller.setForeground(false)
    try {
      await onResetAllData()
      await clearAppLockAfterArchiveReset()
      setMode('system')
      setDefaultTextScale(1)
      await controller.initialize()
    } finally {
      recoveryActive.current = false
      setRecovering(false)
      controller.setForeground(AppState.currentState === 'active')
    }
  }, [controller, onResetAllData, setMode, setDefaultTextScale])
  const loaded = state ?? controller.getState()
  const current = recovering ? { ...loaded, busy: true } : loaded
  const canRead = !recovering && current.status === 'unlocked' && privacyReady && !privacyError
  return (
    <AppLockContext.Provider value={{ state: current, controller, privacyError }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {canRead ? (
          children
        ) : (
          <LockGate
            state={current}
            controller={controller}
            privacyError={privacyError}
            onResetAllData={onResetAllData ? recover : undefined}
          />
        )}
      </View>
    </AppLockContext.Provider>
  )
}
function LockGate({
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
  const [pin, setPin] = useState('')
  const [now, setNow] = useState(Date.now)
  const [resetError, setResetError] = useState<string | null>(null)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const waiting = Math.max(0, Math.ceil((state.record.cooldownUntil - now) / 1000))
  const submit = async () => {
    const entered = pin
    setPin('')
    await controller.unlock(entered)
  }
  return (
    <ScrollView
      accessibilityViewIsModal
      keyboardShouldPersistTaps='handled'
      className='bg-wa-bg flex-1'
      contentContainerStyle={{ flexGrow: 1 }}
      contentContainerClassName='items-center justify-center px-6 py-8'
    >
      <View className='w-full max-w-sm gap-4'>
        <Text className='text-wa-text-primary text-2xl font-bold'>Kinsay is locked</Text>
        {state.status === 'loading' || (state.status === 'unlocked' && !privacyError) ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text className='text-wa-text-secondary'>
              Use your Kinsay passcode. This is separate from your phone PIN.
            </Text>
            {state.status === 'locked' && !privacyError ? (
              <>
                <TextInput
                  accessibilityLabel='Kinsay passcode'
                  placeholder='6–12 digit Kinsay passcode'
                  secureTextEntry
                  keyboardType='number-pad'
                  maxLength={12}
                  value={pin}
                  onChangeText={setPin}
                  autoComplete='off'
                  textContentType='none'
                  className='bg-wa-input text-wa-text-primary min-h-12 rounded-xl px-4'
                  editable={!state.busy && waiting === 0}
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  accessibilityRole='button'
                  disabled={state.busy || waiting > 0 || !pin}
                  onPress={() => void submit()}
                  className='bg-wa-accent min-h-12 items-center justify-center rounded-xl'
                  style={{ opacity: state.busy || waiting > 0 ? 0.5 : 1 }}
                >
                  <Text className='text-wa-on-accent font-semibold'>
                    {state.busy ? 'Checking…' : waiting ? `Try again in ${waiting}s` : 'Unlock'}
                  </Text>
                </Pressable>
                {state.record.biometrics ? (
                  <Pressable
                    accessibilityRole='button'
                    disabled={state.busy || waiting > 0}
                    onPress={() => void controller.unlockBiometric()}
                    className='min-h-11 items-center justify-center'
                  >
                    <Text className='text-wa-accent'>Unlock with biometrics</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
            {state.error || privacyError ? (
              <Text className='text-wa-error'>{state.error ?? privacyError}</Text>
            ) : null}
            {state.status === 'error' ? (
              <Pressable
                accessibilityRole='button'
                onPress={() => void controller.initialize()}
                className='min-h-11 items-center justify-center'
              >
                <Text className='text-wa-accent'>Retry secure storage</Text>
              </Pressable>
            ) : null}
            <Text className='text-wa-text-secondary text-xs'>
              Forgot the passcode? Recovery requires deleting the local archive and importing your
              exports again. Reinstalling may leave secure credentials on iOS.
            </Text>
            {onResetAllData ? (
              <Pressable
                accessibilityRole='button'
                disabled={state.busy}
                onPress={() => {
                  setResetError(null)
                  void onResetAllData().catch(() =>
                    setResetError('Archive reset did not finish. The lock is still active.')
                  )
                }}
                className='min-h-11 items-center justify-center'
              >
                <Text className='text-wa-error'>Reset local archive…</Text>
              </Pressable>
            ) : null}
            {resetError ? <Text className='text-wa-error'>{resetError}</Text> : null}
          </>
        )}
      </View>
    </ScrollView>
  )
}
