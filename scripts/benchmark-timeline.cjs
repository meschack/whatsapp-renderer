const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
const ts = require('typescript')

// Load the same pure TypeScript used by the native app, without native modules.
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  })
  module._compile(compiled.outputText, filename)
}
const { buildTimelineItems, mergeTimelineWindow } = require(
  path.join(__dirname, '../utils/chat-timeline.ts')
)
const record = sequence => ({
  sequence,
  message: {
    id: `msg-${sequence}`,
    sender: 'Alice',
    text: 'A normal message',
    mediaType: null,
    isSystem: false,
    timestamp: new Date(2026, 7, 1 + Math.floor(sequence / 50))
  }
})
const current = Array.from({ length: 600 }, (_, i) => record(i + 1))
const incoming = Array.from({ length: 100 }, (_, i) => record(i + 601))
function previousMerge() {
  const map = new Map()
  for (const row of current) map.set(row.sequence, row)
  for (const row of incoming) map.set(row.sequence, row)
  return [...map.values()].sort((a, b) => a.sequence - b.sequence).slice(-600)
}
function measure(operation, iterations) {
  for (let i = 0; i < 30; i++) operation()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) operation()
  return Number(((performance.now() - start) / iterations).toFixed(3))
}
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      messages: current.length,
      incoming: incoming.length,
      previousMergeMs: measure(previousMerge, 3000),
      linearMergeMs: measure(() => mergeTimelineWindow(current, incoming, 'newer', 600), 3000),
      presentationMs: measure(() => buildTimelineItems(current, new Date(2026, 7, 25)), 100)
    },
    null,
    2
  )
)
