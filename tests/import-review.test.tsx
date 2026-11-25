import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportReview } from '../components/home/import-review'
import type { ChatImportPreview } from '../utils/chat-import-workflow'
import type { SavedChat } from '../models/types'

vi.mock('@/src/tw', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView'
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount())
  tree = undefined
})

const chat: SavedChat = {
  id: 'masha',
  chatName: 'Masha',
  myName: 'Me',
  participants: ['Me', 'Masha'],
  extractDirUri: 'file:///masha',
  messageCount: 10,
  lastMessageText: 'Hi',
  lastMessageTime: '2026-08-23T10:00:00Z',
  importedAt: '2026-08-23T10:00:00Z',
  isArchived: true
}
const preview: ChatImportPreview = {
  outcome: 'imported',
  chatName: 'Masha-2',
  targetChat: null,
  availableChats: [chat],
  messageCount: 4,
  newMessageCount: 4,
  mediaCount: 0,
  ambiguousMedia: [],
  ambiguousDateCount: 0,
  reconciliation: false
}

describe('import review target selection', () => {
  it('lets users find an archived chat and choose it without confirming the import', async () => {
    const choose = vi.fn(),
      accept = vi.fn()
    await act(async () => {
      tree = create(
        <ImportReview
          preview={preview}
          onChooseChat={choose}
          onAccept={accept}
          onCancel={vi.fn()}
        />
      )
    })
    await act(async () =>
      tree!.root.findByProps({ testID: 'import-review-choose-chat' }).props.onPress()
    )
    const search = tree!.root.findByProps({ accessibilityLabel: 'Search saved chats' })
    await act(async () => search.props.onChangeText('nobody'))
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Add export to Masha' })).toHaveLength(0)
    await act(async () => search.props.onChangeText('MASHA'))
    await act(async () =>
      tree!.root.findByProps({ accessibilityLabel: 'Add export to Masha' }).props.onPress()
    )
    expect(choose).toHaveBeenCalledWith('masha')
    expect(accept).not.toHaveBeenCalled()
  })

  it('does not offer redirection for automatically matched imports', async () => {
    await act(async () => {
      tree = create(
        <ImportReview
          preview={{ ...preview, targetChat: chat, availableChats: undefined, outcome: 'updated' }}
          onChooseChat={vi.fn()}
          onAccept={vi.fn()}
          onCancel={vi.fn()}
        />
      )
    })
    expect(tree!.root.findAllByProps({ testID: 'import-review-choose-chat' })).toHaveLength(0)
  })
})
