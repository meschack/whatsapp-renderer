import { describe, expect, it } from 'vitest'
import {
  buildParticipantColorMap,
  getIdentityColor,
  getInitials,
  shouldShowGroupSenderName
} from '../utils/participant-identity'

describe('participant identity', () => {
  it('creates compact initials from names without depending on render state', () => {
    expect(getInitials('Alice')).toBe('A')
    expect(getInitials('Jean Claude Van Damme')).toBe('JD')
    expect(getInitials('  +229 97 00 00 00 ')).toBe('+0')
    expect(getInitials('')).toBe('?')
  })

  it('returns the same avatar color for the same identity', () => {
    expect(getIdentityColor('Alice')).toBe(getIdentityColor('Alice'))
    expect(getIdentityColor('Alice')).not.toBe(getIdentityColor('Bob'))
  })

  it('assigns deterministic, distinct colors inside a participant set', () => {
    const participants = ['Zoé', 'Armel', 'Moi', 'Briand']
    const first = buildParticipantColorMap(participants)
    const reordered = buildParticipantColorMap([...participants].reverse())

    expect(first).toEqual(reordered)
    expect(new Set(Object.values(first))).toHaveLength(participants.length)
  })

  it('deduplicates participants without changing their identity assignment', () => {
    expect(buildParticipantColorMap(['Alice', 'Alice', 'Bob'])).toEqual(
      buildParticipantColorMap(['Bob', 'Alice'])
    )
  })

  it('shows names only at incoming group sender boundaries', () => {
    const boundary = { isMine: false, isSenderBoundary: true, sender: 'Alice' }
    expect(shouldShowGroupSenderName({ ...boundary, participantCount: 4 })).toBe(true)
    expect(shouldShowGroupSenderName({ ...boundary, participantCount: 2 })).toBe(false)
    expect(
      shouldShowGroupSenderName({ ...boundary, participantCount: 4, isSenderBoundary: false })
    ).toBe(false)
    expect(shouldShowGroupSenderName({ ...boundary, participantCount: 4, isMine: true })).toBe(
      false
    )
  })
})
