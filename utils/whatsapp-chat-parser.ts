import type { MediaMap, Message } from '../models/types'
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

const MEDIA_EXTENSIONS: Record<string, Message['mediaType']> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  mp4: 'video',
  mkv: 'video',
  avi: 'video',
  mov: 'video',
  '3gp': 'video',
  opus: 'audio',
  mp3: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  aac: 'audio',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  zip: 'document',
  vcf: 'document'
}

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

function collectRawMessages(content: string): RawMessage[] {
  const messages: RawMessage[] = []
  let current: RawMessage | null = null

  for (const line of content.split(/\r?\n/)) {
    const start = matchMessageStart(line)

    if (!start) {
      if (current) current.text += `\n${line}`
      continue
    }

    if (current) messages.push(current)

    const senderMessage = start.rest.match(SENDER_MESSAGE_REGEX)
    current = senderMessage
      ? {
          date: start.date,
          time: start.time,
          sender: senderMessage[1].trim(),
          text: senderMessage[2]
        }
      : { date: start.date, time: start.time, sender: null, text: start.rest }
  }

  if (current) messages.push(current)
  return messages
}

function inferDateOrder(messages: RawMessage[]): DateOrder {
  let dmyEvidence = 0
  let mdyEvidence = 0

  for (const message of messages) {
    const [first, second] = message.date.split('/').map(Number)
    if (first > 12) dmyEvidence++
    if (second > 12) mdyEvidence++
  }

  return dmyEvidence > mdyEvidence ? 'DMY' : 'MDY'
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
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return {
    mediaType: MEDIA_EXTENSIONS[extension] ?? 'document',
    mediaUri: mediaMap.get(filename) ?? null
  } satisfies Pick<Message, 'mediaType' | 'mediaUri'>
}

function detectMedia(text: string, mediaMap: MediaMap) {
  const stripped = text.replace(INVISIBLE_CHARS, '').trim()

  if (OMITTED_MEDIA_PATTERNS.some(pattern => pattern.test(stripped))) {
    return { mediaType: 'image' as const, mediaUri: null, cleanText: null }
  }

  const angleAttached = stripped.match(ATTACHED_ANGLE_REGEX)
  if (angleAttached) {
    return { ...mediaForFilename(angleAttached[1].trim(), mediaMap), cleanText: null }
  }

  const suffixAttached = stripped.match(ATTACHED_SUFFIX_REGEX)
  if (suffixAttached) {
    const filename = suffixAttached[1].trim()
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    if (mediaMap.has(filename) || MEDIA_EXTENSIONS[extension]) {
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

  return { mediaType: null, mediaUri: null, cleanText: text }
}

function detectMyName(messages: RawMessage[], participants: string[], myName?: string): string | null {
  if (myName) return myName
  if (participants.length !== 2) return null

  const counts = new Map<string, number>()
  for (const message of messages) {
    if (message.sender) counts.set(message.sender, (counts.get(message.sender) ?? 0) + 1)
  }

  return participants.reduce<string | null>((mostFrequent, participant) => {
    if (!mostFrequent) return participant
    return (counts.get(participant) ?? 0) > (counts.get(mostFrequent) ?? 0)
      ? participant
      : mostFrequent
  }, null)
}

export function visitWhatsAppChat(
  content: string,
  mediaMap: MediaMap,
  myName: string | undefined,
  visit: (message: Message) => void
): WhatsAppChatMetadata {
  const rawMessages = collectRawMessages(content)
  const participants = Array.from(
    new Set(rawMessages.flatMap(message => (message.sender ? [message.sender] : [])))
  )
  const dateOrder = inferDateOrder(rawMessages)
  const detectedMyName = detectMyName(rawMessages, participants, myName)
  let messageCount = 0

  rawMessages.forEach((raw, index) => {
    const { cleanText: editedText, isEdited } = stripEditedMarker(raw.text)
    const { mediaType, mediaUri, cleanText } = detectMedia(editedText ?? '', mediaMap)
    const text = cleanText?.trim() ? cleanText : null

    if (mediaType === 'image' && mediaUri === null && text === null) return

    visit({
      id: `msg-${index}`,
      sender: raw.sender,
      text,
      mediaType,
      mediaUri,
      timestamp: parseTimestamp(raw.date, raw.time, dateOrder),
      isEdited,
      isMine: raw.sender === detectedMyName,
      isSystem: raw.sender === null
    })
    messageCount++
  })

  return { participants, messageCount }
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
