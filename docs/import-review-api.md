# Import planning and cancellation

`importChat({ temporaryArchiveUri, archiveName, signal?, onProgress?, onReview? })`
now accepts an optional review callback. `onReview(preview)` must return `true`
to continue, or a promise resolving to `true`. Returning `false` cancels and
cleans up the staged import. Aborting the request while review is pending also
cancels immediately; the UI should dismiss its review surface when it aborts.
No attachment indexing or message writes happen before review is accepted.
Existing callers without a callback keep their existing import behavior.

`ChatImportPreview` (exported from `utils/chat-import-workflow.ts`) contains:

- `outcome`: `imported`, `updated`, or `up-to-date`.
- `chatName` and `targetChat`: the proposed display name and the existing chat
  proven by its fingerprint or history, or `null` for a new chat.
- `messageCount` and `newMessageCount`: transcript total and appended count;
  reconciliation is reported separately by `reconciliation`.
- `mediaCount`: the unambiguous files that will be indexed for this import.
- `ambiguousMedia`: conflicting basenames with every retained archive-relative
  path. Neither conflicting file is bound to a basename reference.
- `ambiguousDateCount`: the parser's date-order ambiguity diagnostic count.

For an exact duplicate, the preview uses existing saved message/date metadata
and zero new messages/media. For imports and updates the preview is computed
by streaming the transcript without persisting messages. History matching is
still the sole proof for an update; review cannot redirect it to another chat.

Progress includes a `reviewing` phase. Discovery reports a count of examined
entries with `phaseTotal: 0` while the total is unknown. Extraction reports
entry progress for JSZip. Native unzip has no abort API: cancellation is checked
after it finishes, then its output is removed. Its progress text makes this
waiting behavior explicit; callers must keep the cancellation state visible
until the import promise settles. Large native MD5 operations and individual
ZIP entry decodes also finish their active operation before cancellation can
be checked.

`MediaCandidate.relativePath` preserves a file's location under the export
root. Fingerprints incorporate this path. `findAmbiguousMedia` and
`unambiguousMediaCandidates` are exported from `utils/media-candidates.ts`.
`discoverChatArchive(directoryUri, signal?, onProgress?)` provides cancellable
async discovery; `scanForMedia` and `findChatFile` remain synchronous for
existing maintenance callers. Parsing, transcript reads, matching, discovery,
extraction, and indexing receive the request signal. Parsing and discovery yield
periodically so cancellation events can run during large imports. The workflow
checks cancellation immediately before its final database commit; the commit
itself completes atomically through the existing database implementation.
