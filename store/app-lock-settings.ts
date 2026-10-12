import * as SecureStore from 'expo-secure-store'
import { getRandomBytesAsync } from 'expo-crypto'
import { DEFAULT_APP_LOCK, isAppLockRecord, type AppLockRecord } from '@/utils/app-lock-policy'
import { createPasscodeVerifier } from '@/utils/passcode'
const LOCK_KEY = 'kinsay.app-lock.v1'
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'kinsay.app-lock',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}
export async function getAppLockSettings(): Promise<AppLockRecord> {
  const value = await SecureStore.getItemAsync(LOCK_KEY, OPTIONS)
  if (value === null) return { ...DEFAULT_APP_LOCK }
  const parsed: unknown = JSON.parse(value)
  if (!isAppLockRecord(parsed)) throw new Error('Invalid stored Kinsay lock')
  return parsed
}
export async function saveAppLockSettings(record: AppLockRecord): Promise<void> {
  if (!isAppLockRecord(record)) throw new Error('Invalid Kinsay lock settings')
  await SecureStore.setItemAsync(LOCK_KEY, JSON.stringify(record), OPTIONS)
}
export async function makeAppPasscodeVerifier(pin: string) {
  return createPasscodeVerifier(pin, await getRandomBytesAsync(16))
}
/** Call only after a confirmed complete archive reset; this is a destructive recovery path. */
export async function clearAppLockAfterArchiveReset(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCK_KEY, OPTIONS)
}
