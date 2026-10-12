import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren
} from 'react'
import { AppState, Platform, StyleSheet } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as ScreenCapture from 'expo-screen-capture'
import { View } from '@/src/tw'
import { LockGate } from './app-lock-screen'
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
        {current.status === 'unlocked' && !recovering ? (
          <View
            style={{ flex: 1, opacity: canRead ? 1 : 0 }}
            pointerEvents={canRead ? 'auto' : 'none'}
            accessibilityElementsHidden={!canRead}
            importantForAccessibility={canRead ? 'auto' : 'no-hide-descendants'}
          >
            {children}
          </View>
        ) : null}
        {!canRead ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}>
            <LockGate
              state={current}
              controller={controller}
              privacyError={privacyError}
              onResetAllData={onResetAllData ? recover : undefined}
            />
          </View>
        ) : null}
      </View>
    </AppLockContext.Provider>
  )
}
