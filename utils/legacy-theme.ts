import type { AppColors } from '../constants/theme'

const semantic: Record<string, { token: string; color: keyof AppColors }> = {
  '0b141a': { token: 'wa-bg', color: 'background' },
  '111b21': { token: 'wa-bg', color: 'background' },
  '182229': { token: 'wa-header', color: 'headerBackground' },
  '202c33': { token: 'wa-header', color: 'headerBackground' },
  '202c2c': { token: 'wa-bubble-other', color: 'bubbleOther' },
  '1f2c34': { token: 'wa-header', color: 'headerBackground' },
  '2a3942': { token: 'wa-input', color: 'inputBackground' },
  e9edef: { token: 'wa-text-primary', color: 'textPrimary' },
  f1f4f5: { token: 'wa-text-primary', color: 'textPrimary' },
  d1d7db: { token: 'wa-text-primary', color: 'textPrimary' },
  aebac1: { token: 'wa-text-secondary', color: 'textSecondary' },
  '8696a0': { token: 'wa-text-secondary', color: 'textSecondary' },
  '667781': { token: 'wa-icon', color: 'iconColor' },
  '3b4a54': { token: 'wa-divider', color: 'divider' },
  '00a884': { token: 'wa-accent', color: 'accent' },
  '00c896': { token: 'wa-accent-light', color: 'accentLight' },
  '06cf9c': { token: 'wa-accent-light', color: 'accentLight' },
  '005c4b': { token: 'wa-bubble-mine', color: 'bubbleMine' },
  '075e48': { token: 'wa-bubble-mine', color: 'bubbleMine' },
  '53bdeb': { token: 'wa-checkmark', color: 'checkmark' },
  ff6b6b: { token: 'wa-error', color: 'error' },
  f15c6d: { token: 'wa-error', color: 'error' }
}
const cache = new Map<string, string>()
/** Translate legacy literal utilities once; semantic CSS variables follow the theme. */
export function themeClasses(className?: string): string | undefined {
  if (!className) return className
  const cached = cache.get(className)
  if (cached) return cached
  const result = className.replace(
    /(bg|text|border)-\[#([\da-f]{6})\]/gi,
    (match, utility: string, hex: string) => {
      const entry = semantic[hex.toLowerCase()]
      // Fixed dark ink on colored avatars/badges is deliberate in either theme.
      if (
        utility === 'text' &&
        ['background', 'headerBackground', 'inputBackground', 'bubbleMine'].includes(
          entry?.color ?? ''
        )
      )
        return match
      return entry ? `${utility}-${entry.token}` : match
    }
  )
  if (cache.size >= 256) cache.delete(cache.keys().next().value!)
  cache.set(className, result)
  return result
}
export function themeLiteralColor(color: string, palette: AppColors): string {
  const entry = semantic[color.replace(/^#/, '').toLowerCase()]
  return entry ? palette[entry.color] : color
}
