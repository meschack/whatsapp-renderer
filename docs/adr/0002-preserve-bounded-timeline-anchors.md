# Preserve the visible message across bounded timeline updates

The timeline retains a device-specific maximum number of messages. When a newer
page is appended, records at the older edge are trimmed. The message count can
stay unchanged even though every item's index moves.

FlashList 2.3.0 only searched outside its engaged rows for a tracked anchor when
`data.length` changed. With a full window, a surviving visible message could move
outside that range. The old pixel offset then pointed at later messages.

`scripts/patch-flash-list.cjs` adds data-array identity to that change check in
both the shipped JavaScript and TypeScript source. `postinstall` applies it on
clean installs, with a pinned version and explicit checks against changed
upstream code. Review and remove this patch when upgrading to an upstream fix.

The regression `tests/scroll-pagination.test.ts` drives the real page loader and
FlashList offset-correction hook with deterministic row geometry. Before the
patch it changes the visible anchor from `msg-5` to `msg-7`; afterward `msg-5`
stays visible. Both native-anchor and direct-offset paths are exercised.

Image-group keys also remain stable when another page extends their tail.
Startup restoration is captured once per chat/jump session, and Android memory
capacity resolves before the first page loads. Paging merges ordered database
rows linearly while preserving the existing memory ceiling.

This verifies the paging mechanism in code. Actual device frame times, touch
scrolling, mixed-height media and orientation behavior still require device
verification. Native smoke checks are manual-only; local development does not
launch emulators as part of these tests.
