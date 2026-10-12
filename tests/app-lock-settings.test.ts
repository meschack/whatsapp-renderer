import { describe, expect, it, vi, beforeEach } from 'vitest'
const state = vi.hoisted(() => ({
  value: null as string | null,
  readError: false,
  writeError: false
}))
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: vi.fn(async () => {
    if (state.readError) throw new Error('Keychain unavailable')
    return state.value
  }),
  setItemAsync: vi.fn(async (_key: string, value: string) => {
    if (state.writeError) throw new Error('Keychain write denied')
    state.value = value
  }),
  deleteItemAsync: vi.fn(async () => {
    state.value = null
  })
}))
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn(async () => new Uint8Array(16)) }))
import * as SecureStore from 'expo-secure-store'
import {
  clearAppLockAfterArchiveReset,
  getAppLockSettings,
  saveAppLockSettings
} from '../store/app-lock-settings'
import { DEFAULT_APP_LOCK } from '../utils/app-lock-policy'

describe('secure lock settings', () => {
  beforeEach(() => {
    state.value = null
    state.readError = false
    state.writeError = false
    vi.clearAllMocks()
  })
  it('loads absent credentials as disabled and stores only validated verifier settings', async () => {
    expect(await getAppLockSettings()).toEqual(DEFAULT_APP_LOCK)
    const record = {
      ...DEFAULT_APP_LOCK,
      verifier: {
        version: 1 as const,
        rounds: 600_000,
        salt: 'a'.repeat(32),
        digest: 'b'.repeat(64)
      },
      failedAttempts: 5,
      cooldownUntil: 80_000
    }
    await saveAppLockSettings(record)
    expect(await getAppLockSettings()).toEqual(record)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'kinsay.app-lock.v1',
      expect.any(String),
      expect.objectContaining({ keychainAccessible: 6 })
    )
    await clearAppLockAfterArchiveReset()
    expect(await getAppLockSettings()).toEqual(DEFAULT_APP_LOCK)
  })
  it('propagates unreadable, malformed and corrupt credentials for fail-closed handling', async () => {
    state.readError = true
    await expect(getAppLockSettings()).rejects.toThrow()
    state.readError = false
    state.value = '{bad'
    await expect(getAppLockSettings()).rejects.toThrow()
    state.value = JSON.stringify({ ...DEFAULT_APP_LOCK, verifier: { rounds: 1 } })
    await expect(getAppLockSettings()).rejects.toThrow()
    state.value = JSON.stringify({ ...DEFAULT_APP_LOCK, failedAttempts: -1 })
    await expect(getAppLockSettings()).rejects.toThrow()
  })
  it('never masks secure write failures', async () => {
    state.writeError = true
    await expect(saveAppLockSettings(DEFAULT_APP_LOCK)).rejects.toThrow()
  })
})
