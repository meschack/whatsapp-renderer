import { isPasscodeVerifier, isValidPasscode, type PasscodeVerifier } from './passcode'
export interface AppLockRecord {
  version: 1
  verifier: PasscodeVerifier | null
  failedAttempts: number
  cooldownUntil: number
  biometrics: boolean
  hideAppPreview: boolean
}
export const DEFAULT_APP_LOCK: AppLockRecord = {
  version: 1,
  verifier: null,
  failedAttempts: 0,
  cooldownUntil: 0,
  biometrics: false,
  hideAppPreview: false
}
export function isAppLockRecord(value: unknown): value is AppLockRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as AppLockRecord
  return (
    record.version === 1 &&
    (record.verifier === null || isPasscodeVerifier(record.verifier)) &&
    Number.isSafeInteger(record.failedAttempts) &&
    record.failedAttempts >= 0 &&
    Number.isSafeInteger(record.cooldownUntil) &&
    record.cooldownUntil >= 0 &&
    typeof record.biometrics === 'boolean' &&
    typeof record.hideAppPreview === 'boolean' &&
    (record.verifier !== null || !record.biometrics)
  )
}
export type AppLockStatus = 'loading' | 'locked' | 'unlocked' | 'error'
export interface AppLockState {
  status: AppLockStatus
  record: AppLockRecord
  busy: boolean
  error: string | null
}
interface LockDependencies {
  load(): Promise<AppLockRecord>
  save(record: AppLockRecord): Promise<void>
  create(pin: string): Promise<PasscodeVerifier>
  verify(pin: string, verifier: PasscodeVerifier): Promise<boolean>
  biometric(): Promise<boolean>
  now(): number
}
export function getFailedAttempt(record: AppLockRecord, now: number): AppLockRecord {
  const failedAttempts = Math.min(record.failedAttempts + 1, 1_000_000)
  return {
    ...record,
    failedAttempts,
    cooldownUntil:
      failedAttempts < 5
        ? 0
        : now + Math.min(300_000, 30_000 * 2 ** Math.min(failedAttempts - 5, 4))
  }
}
/** Owns serialization and lifecycle cancellation; no async result may reopen a backgrounded app. */
export function createAppLockController(
  deps: LockDependencies,
  changed: (state: AppLockState) => void
) {
  let state: AppLockState = {
    status: 'loading',
    record: { ...DEFAULT_APP_LOCK },
    busy: false,
    error: null
  }
  let generation = 0
  let foreground = true
  const publish = (patch: Partial<AppLockState>) => {
    state = { ...state, ...patch }
    changed(state)
  }
  const failClosed = () =>
    publish({
      status: 'error',
      error:
        'Kinsay could not read or save its lock. Your archive stays locked. Retry, or reset the archive to recover.'
    })
  const save = async (record: AppLockRecord) => {
    const savingGeneration = generation
    await deps.save(record)
    publish({
      record,
      ...((!foreground || generation !== savingGeneration) && record.verifier
        ? { status: 'locked' as const }
        : !record.verifier && state.status === 'locked'
          ? { status: 'unlocked' as const }
          : {})
    })
  }
  const run = async (operation: (generation: number) => Promise<boolean>) => {
    if (state.busy || !foreground) return false
    const started = generation
    publish({ busy: true, error: null })
    try {
      return await operation(started)
    } catch {
      failClosed()
      return false
    } finally {
      publish({ busy: false })
    }
  }
  const authenticate = async (pin: string) => {
    if (!state.record.verifier || state.record.cooldownUntil > deps.now()) {
      publish({ error: 'Too many attempts. Wait for the cooldown before trying again.' })
      return false
    }
    // Reserve/persist each attempt before hashing so force-closing cannot dodge throttling.
    const verifier = state.record.verifier
    await save(getFailedAttempt(state.record, deps.now()))
    if (!(await deps.verify(pin, verifier))) {
      publish({ error: 'That Kinsay passcode did not match.' })
      return false
    }
    await save({ ...state.record, failedAttempts: 0, cooldownUntil: 0 })
    return true
  }
  return {
    getState: () => state,
    async initialize() {
      if (state.busy) return
      publish({ busy: true, status: 'loading', error: null })
      try {
        const record = await deps.load()
        if (!isAppLockRecord(record)) throw new Error('Invalid lock record')
        publish({ record, status: record.verifier ? 'locked' : 'unlocked' })
      } catch {
        failClosed()
      } finally {
        publish({ busy: false })
      }
    },
    lock() {
      generation++
      if (state.record.verifier) publish({ status: 'locked', error: null })
    },
    setForeground(active: boolean) {
      foreground = active
      if (!active) {
        generation++
        if (state.record.verifier) publish({ status: 'locked', error: null })
      }
    },
    unlock(pin: string) {
      return run(async started => {
        if (state.status !== 'locked' || !(await authenticate(pin))) return false
        if (generation !== started || !foreground) return false
        publish({ status: 'unlocked' })
        return true
      })
    },
    setup(pin: string, confirmation: string) {
      return run(async started => {
        if (state.status !== 'unlocked' || state.record.verifier) return false
        if (!isValidPasscode(pin) || pin !== confirmation) {
          publish({ error: 'Use 6–12 digits and enter the same passcode twice.' })
          return false
        }
        const verifier = await deps.create(pin)
        if (generation !== started || !foreground) return false
        await save({ ...DEFAULT_APP_LOCK, hideAppPreview: true, verifier })
        return generation === started && foreground
      })
    },
    change(current: string, pin: string, confirmation: string) {
      return run(async started => {
        if (state.status !== 'unlocked' || !isValidPasscode(pin) || pin !== confirmation) {
          publish({ error: 'Use 6–12 digits and matching confirmation.' })
          return false
        }
        if (!(await authenticate(current))) return false
        const verifier = await deps.create(pin)
        if (generation !== started || !foreground) return false
        await save({ ...state.record, verifier })
        return true
      })
    },
    disable(pin: string) {
      return run(async started => {
        if (
          state.status !== 'unlocked' ||
          !(await authenticate(pin)) ||
          generation !== started ||
          !foreground
        )
          return false
        await save({ ...DEFAULT_APP_LOCK })
        return true
      })
    },
    configure(pin: string, options: Pick<AppLockRecord, 'biometrics' | 'hideAppPreview'>) {
      return run(async started => {
        if (
          state.status !== 'unlocked' ||
          !(await authenticate(pin)) ||
          generation !== started ||
          !foreground
        )
          return false
        await save({ ...state.record, ...options })
        return true
      })
    },
    unlockBiometric() {
      return run(async started => {
        if (
          state.status !== 'locked' ||
          !state.record.verifier ||
          !state.record.biometrics ||
          state.record.cooldownUntil > deps.now()
        )
          return false
        await save(getFailedAttempt(state.record, deps.now()))
        if (!(await deps.biometric())) {
          publish({
            error: 'Biometric unlock was cancelled or unavailable. Use your Kinsay passcode.'
          })
          return false
        }
        if (generation !== started || !foreground) return false
        await save({ ...state.record, failedAttempts: 0, cooldownUntil: 0 })
        if (generation !== started || !foreground) return false
        publish({ status: 'unlocked' })
        return true
      })
    }
  }
}
export type AppLockController = ReturnType<typeof createAppLockController>
