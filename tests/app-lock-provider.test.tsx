import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_APP_LOCK, type AppLockController } from '../utils/app-lock-policy'
import { DARK_COLORS } from '../constants/theme'
import { ScrollView } from '@/src/tw'

const fixture = vi.hoisted(() => ({
  load: vi.fn(),
  prevent: vi.fn(),
  listeners: new Set<(state: string) => void>()
}))
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, listener: (state: string) => void) => {
      fixture.listeners.add(listener)
      return { remove: () => fixture.listeners.delete(listener) }
    }
  },
  Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  StatusBar: 'StatusBar',
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }
  }
}))
vi.mock('expo-local-authentication', () => ({}))
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
vi.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: fixture.prevent,
  allowScreenCaptureAsync: async () => {}
}))
vi.mock('@/src/tw', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator'
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('@/store/app-lock-settings', () => ({
  getAppLockSettings: fixture.load,
  saveAppLockSettings: async () => {},
  makeAppPasscodeVerifier: async () => ({
    version: 1,
    rounds: 600_000,
    salt: 'a'.repeat(32),
    digest: 'b'.repeat(64)
  }),
  clearAppLockAfterArchiveReset: async () => {}
}))
vi.mock('@/utils/app-lock-policy', async () => import('../utils/app-lock-policy'))
vi.mock('@/utils/passcode', async () => import('../utils/passcode'))
vi.mock('../components/settings/app-appearance-provider', () => ({
  useAppAppearance: () => ({ colors: DARK_COLORS, setMode: vi.fn(), setDefaultTextScale: vi.fn() })
}))
import { AppLockProvider, useAppLock } from '../components/settings/app-lock-provider'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount())
  tree = undefined
  vi.clearAllMocks()
})

describe('lock provider regressions', () => {
  it('keeps the current app screen mounted when enabling preview protection', async () => {
    fixture.load.mockResolvedValue({ ...DEFAULT_APP_LOCK })
    let finishProtection!: () => void
    fixture.prevent.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishProtection = resolve
        })
    )
    const unmounted = vi.fn()
    const mounted = vi.fn()
    let controller!: AppLockController
    function Screen() {
      controller = useAppLock().controller
      useEffect(() => {
        mounted()
        return unmounted
      }, [])
      return React.createElement('ArchiveScreen')
    }
    await act(async () => {
      tree = create(
        <AppLockProvider>
          <Screen />
        </AppLockProvider>
      )
    })
    expect(mounted).toHaveBeenCalledTimes(1)
    await act(async () => {
      await controller.setup('739182', '739182')
    })
    expect(unmounted.mock.calls.length).toBe(0)
    expect(tree!.root.findByType(Screen).parent!.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants'
    })
    await act(async () => {
      finishProtection()
    })
    expect(mounted.mock.calls.length).toBe(1)
    expect(tree!.root.findAllByType(Screen)).toHaveLength(1)
    expect(tree!.root.findByType(Screen).parent!.props.pointerEvents).toBe('auto')
    await act(async () => {
      controller.setForeground(false)
      controller.setForeground(true)
    })
    expect(unmounted.mock.calls.length).toBe(1)
    expect(tree!.root.findAllByType(Screen)).toHaveLength(0)
    expect(controller.getState().status).toBe('locked')
  })

  it('centers the lock form with native layout styles even without CSS utilities', async () => {
    fixture.load.mockResolvedValue({
      ...DEFAULT_APP_LOCK,
      verifier: { version: 1, rounds: 600_000, salt: 'a'.repeat(32), digest: 'b'.repeat(64) }
    })
    await act(async () => {
      tree = create(
        <AppLockProvider>
          <React.Fragment />
        </AppLockProvider>
      )
    })
    const scroll = tree!.root.findByType(ScrollView)
    expect(scroll.props.contentContainerStyle[0]).toMatchObject({
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center'
    })
  })
})
