// FlashList 2.3.0 only searches outside the engaged rows if data.length changes.
// A bounded chat window can change every row while keeping the same length.
// Keep this small patch until upstream handles same-length window replacement.
const fs = require('node:fs')
const path = require('node:path')

const root = path.dirname(require.resolve('@shopify/flash-list/package.json'))
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
if (version !== '2.3.0')
  throw new Error(`Review the chat scroll-anchor patch before upgrading FlashList (${version}).`)

for (const file of [
  'src/recyclerview/hooks/useRecyclerViewController.tsx',
  'dist/recyclerview/hooks/useRecyclerViewController.js'
]) {
  const target = path.join(root, file)
  let source = fs.readFileSync(target, 'utf8')
  if (source.includes('const lastDataRef = useRef(recyclerViewManager.props.data);')) continue
  const replacements = [
    [
      'const lastDataLengthRef = useRef(recyclerViewManager.getDataLength());',
      'const lastDataLengthRef = useRef(recyclerViewManager.getDataLength());\n  const lastDataRef = useRef(recyclerViewManager.props.data);'
    ],
    [
      'const hasDataChanged = currentDataLength !== lastDataLengthRef.current;',
      'const hasDataChanged = currentDataLength !== lastDataLengthRef.current || data !== lastDataRef.current;'
    ],
    [
      'lastDataLengthRef.current = recyclerViewManager.getDataLength();',
      'lastDataLengthRef.current = recyclerViewManager.getDataLength();\n    lastDataRef.current = recyclerViewManager.props.data;'
    ]
  ]
  for (const [before, after] of replacements) {
    if (!source.includes(before))
      throw new Error(
        `FlashList patch no longer applies to ${file}; do not ship without reviewing scrolling.`
      )
    source = source.replace(before, after)
  }
  fs.writeFileSync(target, source)
}
