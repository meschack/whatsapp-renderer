import type { Message } from '../models/types'

export interface WhatsAppExportMarkerRegistry {
  omittedMedia: readonly string[]
  attachedFileSuffix: readonly string[]
  attachedFileLabel: readonly string[]
}

export type WhatsAppExportMarkerMatch =
  | { kind: 'omitted-media'; caption: string | null }
  | { kind: 'attached-file'; filename: string; caption: string | null }

interface StoredMessageText {
  text: string | null
  mediaType: Message['mediaType']
}

export interface WhatsAppExportMarkerModule {
  match(text: string): WhatsAppExportMarkerMatch | null
  normalizeStoredMessage(message: StoredMessageText): StoredMessageText
  normalizeStoredPreview(text: string | null): string | null
}

/** Add a localized WhatsApp literal here; callers need no matching or migration changes. */
export const WHATSAPP_EXPORT_MARKER_REGISTRY: WhatsAppExportMarkerRegistry = {
  omittedMedia: ['<Media omitted>', '<Média omis>', '<Médias omis>'],
  attachedFileSuffix: ['(file attached)', '(fichier joint)'],
  attachedFileLabel: ['attached', 'pièce jointe']
}

function sameLiteral(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function splitFirstLine(text: string): { line: string; caption: string | null } {
  const newline = text.indexOf('\n')
  if (newline === -1) return { line: text.trim(), caption: null }
  return {
    line: text.slice(0, newline).replace(/\r$/, '').trim(),
    caption: text.slice(newline + 1).trim() || null
  }
}

function matchLeadingLiteral(text: string, markers: readonly string[]): string | null | undefined {
  const trimmed = text.trim()
  for (const marker of markers) {
    if (!sameLiteral(trimmed.slice(0, marker.length), marker)) continue
    const remainder = trimmed.slice(marker.length)
    if (remainder && !/^\s/.test(remainder)) continue
    return remainder.trim() || null
  }
  return undefined
}

export function createWhatsAppExportMarkerModule(
  registry: WhatsAppExportMarkerRegistry
): WhatsAppExportMarkerModule {
  function match(text: string): WhatsAppExportMarkerMatch | null {
    const normalizedText = text.trim()
    const { line, caption } = splitFirstLine(normalizedText)

    if (registry.omittedMedia.some(marker => sameLiteral(line, marker))) {
      return { kind: 'omitted-media', caption }
    }

    for (const marker of registry.attachedFileSuffix) {
      if (!sameLiteral(line.slice(-marker.length), marker)) continue
      const filename = line.slice(0, -marker.length).trim()
      if (filename) return { kind: 'attached-file', filename, caption }
    }

    if (line.startsWith('<') && line.endsWith('>')) {
      const inner = line.slice(1, -1)
      const separator = inner.indexOf(':')
      if (separator > 0) {
        const label = inner.slice(0, separator).trim()
        const filename = inner.slice(separator + 1).trim()
        if (
          filename &&
          registry.attachedFileLabel.some(candidate => sameLiteral(label, candidate))
        ) {
          return { kind: 'attached-file', filename, caption }
        }
      }
    }

    return null
  }

  function normalizeStoredMessage(message: StoredMessageText): StoredMessageText {
    if (!message.text) return message
    const marker = match(message.text)
    if (marker?.kind === 'omitted-media') {
      return { text: marker.caption, mediaType: message.mediaType ?? 'image' }
    }
    if (marker?.kind === 'attached-file') {
      return { text: marker.caption, mediaType: message.mediaType ?? 'image' }
    }

    const caption = matchLeadingLiteral(message.text, registry.attachedFileSuffix)
    if (caption !== undefined) {
      return { text: caption, mediaType: message.mediaType ?? 'image' }
    }
    return message
  }

  function normalizeStoredPreview(text: string | null): string | null {
    if (!text) return text
    const marker = match(text)
    if (marker) return marker.caption
    const caption = matchLeadingLiteral(text, registry.attachedFileSuffix)
    return caption === undefined ? text : caption
  }

  return { match, normalizeStoredMessage, normalizeStoredPreview }
}

export const whatsAppExportMarkers = createWhatsAppExportMarkerModule(
  WHATSAPP_EXPORT_MARKER_REGISTRY
)
