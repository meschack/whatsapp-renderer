import type { MediaMap, Message } from '../models/types'
import { getMediaType } from './media-file'
import { stripEditedMarker } from './message-text'

type DateOrder = 'DMY' | 'MDY'

interface RawMessage {
  date: string
  time: string
  sender: string | null
  text: string
}

interface MessageStart {
  date: string
  time: string
  rest: string
}

interface ChatScan {
  participants: string[]
  participantSet: Set<string>
  senderCounts: Map<string, number>
  dmyEvidence: number
  mdyEvidence: number
}

export interface ParsedWhatsAppChat {
  participants: string[]
  messages: Message[]
}

export interface WhatsAppChatMetadata {
  participants: string[]
  messageCount: number
}

const INVISIBLE_CHARS = /[\u200e\u200f\u200b\u200c\u200d\ufeff\u202a-\u202e\u2066-\u2069]/g
const INVISIBLE_PREFIX =
  '[\\u200e\\u200f\\u200b\\u200c\\u200d\\ufeff\\u202a-\\u202e\\u2066-\\u2069]*'
const DATE = '(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})'
const TIME = '(\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)'

const MESSAGE_START_PATTERNS = [
  new RegExp(`^${INVISIBLE_PREFIX}\\[${DATE},\\s*${TIME}\\]\\s*(.+)$`, 'i'),
  new RegExp(`^${INVISIBLE_PREFIX}${DATE},\\s*${TIME}\\s+-\\s+(.+)$`, 'i')
]

const SENDER_MESSAGE_REGEX = /^([^:]+?):\s([\s\S]*)$/

const MEDIA_FILENAME_REGEX =
  /\b[\w-]+\.(?:jpg|jpeg|png|gif|webp|mp4|mkv|avi|mov|3gp|opus|mp3|m4a|ogg|aac|pdf|doc|docx|xls|xlsx|ppt|pptx|vcf|zip)\b/gi

const OMITTED_MEDIA_PATTERNS = [/^<Media omitted>$/i, /^<M[ée]dias? omis>$/i]
const ATTACHED_ANGLE_REGEX = /<(?:attached|pi[èe]ce jointe)\s*:\s*(.+?)>/i
const ATTACHED_SUFFIX_REGEX = /^(.+?)\s*\((?:file attached|fichier joint)\)$/i

function matchMessageStart(line: string): MessageStart | null {
  for (const pattern of MESSAGE_START_PATTERNS) {
    const match = line.match(pattern)
    if (match) {
      return { date: match[1], time: match[2], rest: match[3] }
    }
  }

  return null
}

class RawMessageAssembler {
  private current: RawMessage | null = null

  push(line: string): RawMessage | null {
    const start = matchMessageStart(line)
    if (!start) {
      if (this.current) this.current.text += `\n${line}`
      return null
    }

    const completed = this.current
    const senderMessage = start.rest.match(SENDER_MESSAGE_REGEX)
    this.current = senderMessage
      ? {
          date: start.date,
          time: start.time,
          sender: senderMessage[1].trim(),
          text: senderMessage[2]
        }
      : { date: start.date, time: start.time, sender: null, text: start.rest }
    return completed
  }

  finish(): RawMessage | null {
    const completed = this.current
    this.current = null
    return completed
  }
}

function* linesIn(content: string): Generator<string> {
  let offset = 0
  while (offset < content.length) {
    const newline = content.indexOf('\n', offset)
    if (newline === -1) {
      yield content.slice(offset).replace(/\r$/, '')
      return
    }

    yield content.slice(offset, newline).replace(/\r$/, '')
    offset = newline + 1
  }
}

async function* linesInChunks(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let pending = ''
  for await (const chunk of chunks) {
    pending += chunk
    let newline = pending.indexOf('\n')
    while (newline !== -1) {
      yield pending.slice(0, newline).replace(/\r$/, '')
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  }

  if (pending.length > 0) yield pending.replace(/\r$/, '')
}

function visitRawMessages(lines: Iterable<string>, visit: (message: RawMessage) => void): void {
  const assembler = new RawMessageAssembler()
  for (const line of lines) {
    const completed = assembler.push(line)
    if (completed) visit(completed)
  }
  const finalMessage = assembler.finish()
  if (finalMessage) visit(finalMessage)
}

async function visitRawMessageChunks(
  chunks: AsyncIterable<string>,
  visit: (message: RawMessage) => void | Promise<void>
): Promise<void> {
  const assembler = new RawMessageAssembler()
  for await (const line of linesInChunks(chunks)) {
    const completed = assembler.push(line)
    if (completed) await visit(completed)
  }
  const finalMessage = assembler.finish()
  if (finalMessage) await visit(finalMessage)
}

function createChatScan(): ChatScan {
  return {
    participants: [],
    participantSet: new Set(),
    senderCounts: new Map(),
    dmyEvidence: 0,
    mdyEvidence: 0
  }
}

function scanRawMessage(scan: ChatScan, message: RawMessage): void {
  const [first, second] = message.date.split('/').map(Number)
  if (first > 12) scan.dmyEvidence++
  if (second > 12) scan.mdyEvidence++

  if (!message.sender) return
  if (!scan.participantSet.has(message.sender)) {
    scan.participantSet.add(message.sender)
    scan.participants.push(message.sender)
  }
  scan.senderCounts.set(message.sender, (scan.senderCounts.get(message.sender) ?? 0) + 1)
}

function inferDateOrder(scan: ChatScan): DateOrder {
  return scan.dmyEvidence > scan.mdyEvidence ? 'DMY' : 'MDY'
}

function parseTimestamp(dateString: string, timeString: string, order: DateOrder): Date {
  const [first, second, rawYear] = dateString.split('/').map(Number)
  const year = rawYear < 100 ? rawYear + 2000 : rawYear
  const day = order === 'DMY' ? first : second
  const month = order === 'DMY' ? second : first

  const isPm = /PM$/i.test(timeString)
  const isAm = /AM$/i.test(timeString)
  const [rawHours, minutes, seconds = 0] = timeString
    .replace(/\s*(AM|PM)$/i, '')
    .split(':')
    .map(Number)

  let hours = rawHours
  if (isPm && hours !== 12) hours += 12
  if (isAm && hours === 12) hours = 0

  return new Date(year, month - 1, day, hours, minutes, seconds)
}

function mediaForFilename(filename: string, mediaMap: MediaMap) {
  const attachment = mediaMap.get(filename)
  return {
    mediaType: attachment?.type ?? getMediaType(filename) ?? 'document',
    mediaUri: attachment?.uri ?? null,
    mediaFilename: attachment?.filename ?? filename,
    mediaSize: attachment?.size ?? null,
    mediaWidth: attachment?.width ?? null,
    mediaHeight: attachment?.height ?? null,
    mediaDuration: attachment?.duration ?? null,
    mediaPreviewUri: attachment?.previewUri ?? null
  } satisfies Pick<
    Message,
    | 'mediaType'
    | 'mediaUri'
    | 'mediaFilename'
    | 'mediaSize'
    | 'mediaWidth'
    | 'mediaHeight'
    | 'mediaDuration'
    | 'mediaPreviewUri'
  >
}

const EMPTY_MEDIA = {
  mediaType: null,
  mediaUri: null,
  mediaFilename: null,
  mediaSize: null,
  mediaWidth: null,
  mediaHeight: null,
  mediaDuration: null,
  mediaPreviewUri: null
} as const

function detectMedia(text: string, mediaMap: MediaMap) {
  const stripped = text.replace(INVISIBLE_CHARS, '').trim()

  if (OMITTED_MEDIA_PATTERNS.some(pattern => pattern.test(stripped))) {
    return { ...EMPTY_MEDIA, mediaType: 'image' as const, cleanText: null }
  }

  const angleAttached = stripped.match(ATTACHED_ANGLE_REGEX)
  if (angleAttached) {
    return { ...mediaForFilename(angleAttached[1].trim(), mediaMap), cleanText: null }
  }

  const suffixAttached = stripped.match(ATTACHED_SUFFIX_REGEX)
  if (suffixAttached) {
    const filename = suffixAttached[1].trim()
    if (mediaMap.has(filename) || getMediaType(filename)) {
      return { ...mediaForFilename(filename, mediaMap), cleanText: null }
    }
  }

  if (mediaMap.has(stripped)) {
    return { ...mediaForFilename(stripped, mediaMap), cleanText: null }
  }

  const candidates = stripped.match(MEDIA_FILENAME_REGEX)
  if (candidates) {
    for (const filename of candidates) {
      if (!mediaMap.has(filename)) continue
      const cleanText = stripped.replace(filename, '').trim() || null
      return { ...mediaForFilename(filename, mediaMap), cleanText }
    }
  }

  return { ...EMPTY_MEDIA, cleanText: text }
}

function detectMyName(scan: ChatScan, myName?: string): string | null {
  if (myName) return myName
  if (scan.participants.length !== 2) return null

  return scan.participants.reduce<string | null>((mostFrequent, participant) => {
    if (!mostFrequent) return participant
    return (scan.senderCounts.get(participant) ?? 0) >
      (scan.senderCounts.get(mostFrequent) ?? 0)
      ? participant
      : mostFrequent
  }, null)
}

function parseRawMessage(
  raw: RawMessage,
  index: number,
  dateOrder: DateOrder,
  detectedMyName: string | null,
  mediaMap: MediaMap
): Message | null {
  const { cleanText: editedText, isEdited } = stripEditedMarker(raw.text)
  const { cleanText, ...media } = detectMedia(editedText ?? '', mediaMap)
  const text = cleanText?.trim() ? cleanText : null

  if (media.mediaType === 'image' && media.mediaUri === null && text === null) return null

  return {
    id: `msg-${index}`,
    sender: raw.sender,
    text,
    ...media,
    timestamp: parseTimestamp(raw.date, raw.time, dateOrder),
    isEdited,
    isMine: raw.sender === detectedMyName,
    isSystem: raw.sender === null
  }
}

export function visitWhatsAppChat(
  content: string,
  mediaMap: MediaMap,
  myName: string | undefined,
  visit: (message: Message) => void
): WhatsAppChatMetadata {
  const scan = createChatScan()
  visitRawMessages(linesIn(content), message => scanRawMessage(scan, message))

  const dateOrder = inferDateOrder(scan)
  const detectedMyName = detectMyName(scan, myName)
  let messageCount = 0
  let rawIndex = 0

  visitRawMessages(linesIn(content), raw => {
    const message = parseRawMessage(raw, rawIndex++, dateOrder, detectedMyName, mediaMap)
    if (!message) return
    visit(message)
    messageCount++
  })

  return { participants: scan.participants, messageCount }
}

export async function visitWhatsAppChatStream(
  openTranscript: () => AsyncIterable<string>,
  mediaMap: MediaMap,
  myName: string | undefined,
  visit: (message: Message) => void | Promise<void>
): Promise<WhatsAppChatMetadata> {
  const scan = createChatScan()
  await visitRawMessageChunks(openTranscript(), message => scanRawMessage(scan, message))

  const dateOrder = inferDateOrder(scan)
  const detectedMyName = detectMyName(scan, myName)
  let messageCount = 0
  let rawIndex = 0

  await visitRawMessageChunks(openTranscript(), async raw => {
    const message = parseRawMessage(raw, rawIndex++, dateOrder, detectedMyName, mediaMap)
    if (!message) return
    await visit(message)
    messageCount++
  })

  return { participants: scan.participants, messageCount }
}

export function parseWhatsAppChat(
  content: string,
  mediaMap: MediaMap,
  myName?: string
): ParsedWhatsAppChat {
  const messages: Message[] = []
  const { participants } = visitWhatsAppChat(content, mediaMap, myName, message => {
    messages.push(message)
  })

  return { participants, messages }
}
