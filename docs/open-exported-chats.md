# Open exported chats in Kinsay

Kinsay accepts one WhatsApp chat export at a time:

- Android: **Open with Kinsay** from a file manager, or **Share → Kinsay** from WhatsApp or a file app.
- iPhone/iPad: **Open in Kinsay** or **Share → Kinsay** for ZIP archives and plain UTF-8 TXT transcripts.
- The in-app import picker accepts both ZIP and TXT files.

Each entry point opens the same import review, including automatic matching and manual selection of a saved chat to update. TXT exports contain no media; the existing importer handles their attachment notices normally. Plain shared text and web links are not imported.

## Runtime path

`app/+native-intent.tsx` routes file URLs and Expo's `expo-sharing` callback into the Home import request. Share callbacks read local payloads directly, without resolving or downloading web URLs. Each callback receives a unique request ID, so reopening the same export while Kinsay is running works.

Before importing, `stageIncomingArchiveFromDevice` copies the source into app cache. A short header check recognizes ZIPs even when Android document-provider URLs hide their filename. TXT transcripts are wrapped in a deterministic ZIP with `_chat.txt`, keeping the existing extraction, parser, review and update workflow. Temporary copies are removed if staging fails; successful staging is cleaned by the importer. Expo's cached share files are cleared only after Kinsay owns a copy. Original external files are never changed or deleted.

On iOS, document opening requests a copy (`LSSupportsOpeningDocumentsInPlace: false`), because this importer does not edit provider documents or hold security-scoped access open. Share-extension files use the app group registered by Expo.

## Native rebuild

These registrations require a **new native binary**. Metro reloads and Expo Go cannot register Kinsay as a file or share target. This repository ignores generated `android/` and `ios/` directories; regenerate them from the tracked configuration before building:

```sh
npx expo prebuild --no-install
npx expo run:android
# On macOS, install pods/build iOS as usual, or use an EAS build.
```

Preserve any local native customizations before regenerating those directories. The `expo-sharing` plugin creates an iOS share-extension target and app-group entitlement. EAS configures the group automatically; a manually signed Xcode build must register the generated `group.<bundleIdentifier>` App Group for both targets. Smoke builds retain their separate bundle identifier and app group.

Expo SDK 55 labels incoming sharing experimental; its iOS extension opens the main app using an approach Apple does not officially support. Keep testing share-sheet behavior on supported iOS versions. [Expo sharing documentation](https://docs.expo.dev/versions/v55.0.0/sdk/sharing/).

## Device smoke checks

Use a newly rebuilt development or release app. For both ZIP and TXT, open an export while the app is closed, then open it again while a chat is visible. Confirm one import review appears each time and the source file remains intact. On Android, include an export from Downloads whose `content://` URI has no filename; also test **Share → Kinsay**. On iPhone, test Files/iCloud **Open in** and the share extension. Cancel review, import a new chat, then import an updated export into a manually selected saved chat. Try a non-chat TXT and verify a useful import error without creating a saved chat.

Unit tests cover URL routing, native registration configuration, hidden-name detection, TXT staging and failure cleanup. They do not replace OS chooser, URI-permission, signing, or iPhone extension tests. TXT wrapping currently reads the transcript into memory, so very large media-free exports should be included in device testing.
