const IDENTITY_COLORS = [
  '#FF8A80',
  '#FFB74D',
  '#FFD54F',
  '#AED581',
  '#4DD0E1',
  '#64B5F6',
  '#7986CB',
  '#BA68C8',
  '#F06292',
  '#80CBC4',
  '#CE93D8',
  '#90CAF9'
] as const

function hashIdentity(identity: string): number {
  let hash = 2166136261
  for (const character of identity.trim().normalize('NFKC').toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getInitials(identity: string): string {
  const words = identity.trim().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return '?'

  const first = Array.from(words[0])[0] ?? '?'
  if (words.length === 1) return first.toLocaleUpperCase()
  const last = Array.from(words.at(-1) ?? '')[0] ?? ''
  return `${first}${last}`.toLocaleUpperCase()
}

export function getIdentityColor(identity: string): string {
  return IDENTITY_COLORS[hashIdentity(identity) % IDENTITY_COLORS.length]
}

/**
 * Resolve hash collisions deterministically for the participants in one chat.
 * The fixed palette gives the common group-chat case unique, readable colors.
 */
export function buildParticipantColorMap(participants: string[]): Record<string, string> {
  const identities = [...new Set(participants.map(item => item.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  )
  const result: Record<string, string> = {}
  const used = new Set<number>()

  for (const identity of identities) {
    const preferred = hashIdentity(identity) % IDENTITY_COLORS.length
    let index = preferred
    for (let offset = 0; offset < IDENTITY_COLORS.length; offset += 1) {
      const candidate = (preferred + offset) % IDENTITY_COLORS.length
      if (!used.has(candidate)) {
        index = candidate
        break
      }
    }
    used.add(index)
    result[identity] = IDENTITY_COLORS[index]
  }

  return result
}

export function shouldShowGroupSenderName(input: {
  participantCount: number
  isMine: boolean
  isSenderBoundary: boolean
  sender: string | null
}): boolean {
  return (
    input.participantCount > 2 && !input.isMine && input.isSenderBoundary && input.sender !== null
  )
}
