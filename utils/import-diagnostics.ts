import type { ImportDiagnosticCategory, ImportDiagnostics } from '../models/types'

export const IMPORT_DIAGNOSTIC_CATEGORIES: ImportDiagnosticCategory[] = [
  'missing-files',
  'unsupported-formats',
  'ambiguous-dates',
  'malformed-records',
  'skipped-content'
]

export function createImportDiagnostics(): ImportDiagnostics {
  return {
    counts: {
      'missing-files': 0,
      'unsupported-formats': 0,
      'ambiguous-dates': 0,
      'malformed-records': 0,
      'skipped-content': 0
    },
    samples: {
      'missing-files': [],
      'unsupported-formats': [],
      'ambiguous-dates': [],
      'malformed-records': [],
      'skipped-content': []
    }
  }
}

export function recordImportDiagnostic(
  diagnostics: ImportDiagnostics,
  category: ImportDiagnosticCategory,
  sample?: string,
  maxSamples = 3
): void {
  diagnostics.counts[category] += 1
  const normalized = sample?.trim()
  if (
    normalized &&
    diagnostics.samples[category].length < maxSamples &&
    !diagnostics.samples[category].includes(normalized)
  ) {
    diagnostics.samples[category].push(normalized.slice(0, 160))
  }
}

export function getImportDiagnosticTotal(diagnostics: ImportDiagnostics): number {
  return IMPORT_DIAGNOSTIC_CATEGORIES.reduce(
    (total, category) => total + diagnostics.counts[category],
    0
  )
}

export function parseImportDiagnostics(
  value: string | null | undefined
): ImportDiagnostics | undefined {
  if (!value) return undefined

  try {
    const parsed = JSON.parse(value) as Partial<ImportDiagnostics>
    const diagnostics = createImportDiagnostics()

    for (const category of IMPORT_DIAGNOSTIC_CATEGORIES) {
      const count = parsed.counts?.[category]
      const samples = parsed.samples?.[category]
      diagnostics.counts[category] =
        typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0
      diagnostics.samples[category] = Array.isArray(samples)
        ? samples.filter((sample): sample is string => typeof sample === 'string').slice(0, 3)
        : []
    }

    return diagnostics
  } catch {
    return undefined
  }
}
