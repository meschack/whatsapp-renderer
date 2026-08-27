import { describe, expect, it } from 'vitest'

import { getImportedChatName } from '../utils/chat-export-name'

describe('chat export name', () => {
  it('extracts WhatsApp naming templates and prefers a specific transcript name', () => {
    expect(getImportedChatName('Discussion WhatsApp avec Armel.zip')).toBe('Armel')
    expect(getImportedChatName('WhatsApp Chat - Armel.zip')).toBe('Armel')
    expect(getImportedChatName('Discussion avec Armel.zip')).toBe('Armel')
    expect(getImportedChatName('Armel.zip')).toBe('Armel')
    expect(
      getImportedChatName(
        'Discussion avec Meschack.zip',
        'Discussion WhatsApp avec Marielle 🤍.txt'
      )
    ).toBe('Marielle 🤍')
    expect(getImportedChatName('Armel (2).zip', '_chat.txt')).toBe('Armel')
  })
})
