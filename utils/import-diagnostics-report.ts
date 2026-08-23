import type { ImportDiagnosticCategory, ImportDiagnostics } from '../models/types'
import { IMPORT_DIAGNOSTIC_CATEGORIES, getImportDiagnosticTotal } from './import-diagnostics'

const CATEGORY_LABELS: Record<ImportDiagnosticCategory, string> = {
  'missing-files': 'Missing files',
  'unsupported-formats': 'Unsupported formats',
  'ambiguous-dates': 'Ambiguous dates',
  'malformed-records': 'Malformed records',
  'skipped-content': 'Skipped content'
}

export function formatImportDiagnosticsReport(diagnostics: ImportDiagnostics): string {
  const total = getImportDiagnosticTotal(diagnostics)
  const sections = IMPORT_DIAGNOSTIC_CATEGORIES.flatMap(category => {
    const count = diagnostics.counts[category]
    if (count === 0) return []

    const samples = diagnostics.samples[category].map(sample => `  • ${sample}`)
    return [[`${CATEGORY_LABELS[category]}: ${count}`, ...samples].join('\n')]
  })

  return [`${total} import notice${total === 1 ? '' : 's'}`, ...sections].join('\n\n')
}
