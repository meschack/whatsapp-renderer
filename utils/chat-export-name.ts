const TEMPLATE_PATTERNS = [
  /^discussion\s+whatsapp\s+avec\s+(.+)$/iu,
  /^discussion\s+avec\s+(.+)$/iu,
  /^whatsapp\s+chat\s+with\s+(.+)$/iu,
  /^whatsapp\s+chat\s*[-–—:]\s*(.+)$/iu
]

function cleanFileStem(filename: string): string {
  return filename
    .trim()
    .replace(/\.(?:zip|txt)$/iu, '')
    .replace(/\s+\(\d+\)$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function extractTemplateName(filename: string): string | null {
  const stem = cleanFileStem(filename)
  for (const pattern of TEMPLATE_PATTERNS) {
    const match = stem.match(pattern)
    const name = match?.[1]?.trim()
    if (name) return name
  }
  return null
}

export function getImportedChatName(archiveName: string, transcriptName?: string): string {
  if (transcriptName) {
    const transcriptNameHint = extractTemplateName(transcriptName)
    if (transcriptNameHint) return transcriptNameHint
  }

  return extractTemplateName(archiveName) ?? (cleanFileStem(archiveName) || 'Chat')
}
