export const PASSCODE_ROUNDS = 600_000
export interface PasscodeVerifier {
  version: 1
  rounds: number
  salt: string
  digest: string
}
export function isValidPasscode(pin: string): boolean {
  return /^\d{6,12}$/.test(pin)
}
const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], part => parseInt(part, 16))
export function isPasscodeVerifier(value: unknown): value is PasscodeVerifier {
  if (!value || typeof value !== 'object') return false
  const record = value as PasscodeVerifier
  return (
    record.version === 1 &&
    Number.isInteger(record.rounds) &&
    record.rounds >= PASSCODE_ROUNDS &&
    record.rounds <= 1_000_000 &&
    /^[a-f0-9]{32}$/.test(record.salt) &&
    /^[a-f0-9]{64}$/.test(record.digest)
  )
}
export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return difference === 0
}
interface PasscodeWorker {
  deriveAsync(pin: string, saltHex: string, rounds: number): Promise<string>
}
/** Keep persisted v1 verifiers compatible; do all PBKDF2 work off the JS and UI threads. */
async function derive(pin: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const { requireOptionalNativeModule } = await import('expo')
  const worker = requireOptionalNativeModule<PasscodeWorker>('KinsayPasscode')
  if (!worker) throw new Error('This build is missing native passcode support. Update Kinsay.')
  const digest = await worker.deriveAsync(pin, toHex(salt), rounds)
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Passcode derivation failed.')
  return fromHex(digest)
}
export async function createPasscodeVerifier(
  pin: string,
  salt: Uint8Array
): Promise<PasscodeVerifier> {
  if (!isValidPasscode(pin)) throw new Error('Choose a Kinsay passcode with 6–12 digits.')
  if (salt.length !== 16) throw new Error('Passcode salt must contain 16 random bytes.')
  const digest = await derive(pin, salt, PASSCODE_ROUNDS)
  try {
    return { version: 1, rounds: PASSCODE_ROUNDS, salt: toHex(salt), digest: toHex(digest) }
  } finally {
    digest.fill(0)
  }
}
export async function verifyPasscode(pin: string, verifier: PasscodeVerifier): Promise<boolean> {
  if (!isPasscodeVerifier(verifier)) throw new Error('The stored passcode is unreadable.')
  if (!isValidPasscode(pin)) return false
  const digest = await derive(pin, fromHex(verifier.salt), verifier.rounds)
  try {
    return constantTimeEqual(digest, fromHex(verifier.digest))
  } finally {
    digest.fill(0)
  }
}
