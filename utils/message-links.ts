export const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

export function extractFirstUrl(text: string): string | null {
  return text.match(URL_REGEX)?.[0] ?? null
}
