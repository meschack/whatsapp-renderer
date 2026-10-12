import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

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
/** PBKDF2-HMAC-SHA256, one 32-byte block. Timers yield to native rendering between batches. */
async function derive(pin: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const password = Uint8Array.from(pin, digit => digit.charCodeAt(0))
  const template = hmac.create(sha256, password)
  const block = new Uint8Array(salt.length + 4)
  block.set(salt)
  block[block.length - 1] = 1
  let current = template.clone().update(block).digest()
  const result = current.slice()
  try {
    for (let iteration = 1; iteration < rounds; iteration++) {
      const previous = current
      current = template.clone().update(previous).digest()
      previous.fill(0)
      for (let index = 0; index < result.length; index++) result[index] ^= current[index]
      if (iteration % 2000 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
    return result
  } finally {
    password.fill(0)
    current.fill(0)
    template.destroy()
    block.fill(0)
  }
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
