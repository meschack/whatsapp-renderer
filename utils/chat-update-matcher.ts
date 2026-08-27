import type { MediaAttachment, Message, SavedChat } from '../models/types'
import type { MediaCandidate } from './media-indexer'
import { visitWhatsAppChatStream } from './whatsapp-chat-parser'

export interface ChatUpdateCandidate {
  chat: SavedChat
  recentMessages: Message[]
}

export interface ChatUpdateMatch {
  chat: SavedChat
  mode: 'append' | 'reconcile-latest'
  skipMessageCount: number
  newMessageCount: number
  mediaFilenames: string[]
}

export interface FindChatUpdateRequest {
  openTranscript: () => AsyncIterable<string>
  mediaCandidates: MediaCandidate[]
  candidates: ChatUpdateCandidate[]
}

interface CandidateMatchState {
  candidate: ChatUpdateCandidate
  recentExportMessages: Message[]
  match: Omit<ChatUpdateMatch, 'chat' | 'newMessageCount' | 'mediaFilenames'> | null
  mediaFilenames: Set<string>
}

function exactMessageMatch(left: Message, right: Message): boolean {
  return (
    sameMessagePosition(left, right) &&
    left.text === right.text &&
    left.mediaType === right.mediaType &&
    left.mediaFilename === right.mediaFilename &&
    left.isEdited === right.isEdited
  )
}

function sameMessagePosition(left: Message, right: Message): boolean {
  return (
    left.timestamp.getTime() === right.timestamp.getTime() &&
    left.sender === right.sender &&
    left.isSystem === right.isSystem
  )
}

function placeholderMediaMap(candidates: MediaCandidate[]): Map<string, MediaAttachment> {
  return new Map(
    candidates.map(candidate => [
      candidate.filename,
      {
        ...candidate,
        width: null,
        height: null,
        duration: null,
        previewUri: null,
        waveform: null
      }
    ])
  )
}

function recordMedia(state: CandidateMatchState, message: Message): void {
  if (message.mediaFilename) state.mediaFilenames.add(message.mediaFilename)
}

function inspectMessage(state: CandidateMatchState, message: Message, messageIndex: number): void {
  if (state.match) {
    if (messageIndex >= state.match.skipMessageCount) recordMedia(state, message)
    return
  }

  const storedTail = state.candidate.recentMessages
  if (storedTail.length === 0) return

  state.recentExportMessages.push(message)
  if (state.recentExportMessages.length > storedTail.length) state.recentExportMessages.shift()
  if (state.recentExportMessages.length !== storedTail.length) return

  if (
    storedTail.every((stored, index) =>
      exactMessageMatch(stored, state.recentExportMessages[index])
    )
  ) {
    state.match = { mode: 'append', skipMessageCount: messageIndex + 1 }
    return
  }

  const precedingCount = storedTail.length - 1
  const precedingMessagesMatch =
    precedingCount >= 5 &&
    storedTail
      .slice(0, precedingCount)
      .every((stored, index) => exactMessageMatch(stored, state.recentExportMessages[index]))
  const exportedLatest = state.recentExportMessages[precedingCount]
  if (
    precedingMessagesMatch &&
    sameMessagePosition(storedTail[precedingCount], exportedLatest) &&
    !exactMessageMatch(storedTail[precedingCount], exportedLatest)
  ) {
    state.match = { mode: 'reconcile-latest', skipMessageCount: messageIndex }
    recordMedia(state, exportedLatest)
  }
}

function matchScore(state: CandidateMatchState): number {
  if (!state.match) return -1
  const certainty = state.match.mode === 'append' ? 2 : 1
  return certainty * 100 + state.candidate.recentMessages.length
}

export async function findChatUpdate(
  request: FindChatUpdateRequest
): Promise<ChatUpdateMatch | null> {
  if (request.candidates.length === 0) return null

  const states: CandidateMatchState[] = request.candidates.map(candidate => ({
    candidate,
    recentExportMessages: [],
    match: null,
    mediaFilenames: new Set()
  }))
  let messageIndex = 0

  const metadata = await visitWhatsAppChatStream(
    request.openTranscript,
    placeholderMediaMap(request.mediaCandidates),
    undefined,
    message => {
      for (const state of states) inspectMessage(state, message, messageIndex)
      messageIndex++
    }
  )

  const matched = states.filter(state => state.match).sort((a, b) => matchScore(b) - matchScore(a))
  if (
    matched.length === 0 ||
    (matched.length > 1 && matchScore(matched[0]) === matchScore(matched[1]))
  ) {
    return null
  }

  const winner = matched[0]
  const match = winner.match!
  const reconciledCount = match.mode === 'reconcile-latest' ? 1 : 0
  return {
    chat: winner.candidate.chat,
    ...match,
    newMessageCount: Math.max(0, metadata.messageCount - match.skipMessageCount - reconciledCount),
    mediaFilenames: [...winner.mediaFilenames]
  }
}
