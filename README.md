# Kinsay

Kinsay turns exported WhatsApp conversations into a fast, browsable local chat archive. Imports, messages, and media stay on the device; the app does not need an Expo development server after a release APK is installed.

## Development

Install dependencies and start Expo:

```bash
npm ci
npx expo start
```

Useful checks:

```bash
npx tsc --noEmit
npm run lint
npm test
```

## Importing chat exports

WhatsApp ZIP exports can be selected from Kinsay's import screen. They can also be opened from another app by choosing Kinsay in Android's **Open with** menu or iOS's **Open in** sheet. Shared archives are copied into Kinsay's cache before the normal import or chat-update flow begins.

## Release builds

The **Kinsay release builds** GitHub Actions workflow creates signed Android builds for 32-bit ARM, 64-bit ARM, universal ARM, and the Play Store, plus an unsigned iOS IPA. Every successful push to `main` publishes all five files together in a prerelease tagged `kinsay-build-<run number>` on the repository's **Releases** page. Version tags matching `v*` publish stable releases, and the workflow can still be started manually.

- `kinsay-universal-arm.apk` is the normal direct-install build for ARM Android phones.
- `kinsay-armeabi-v7a.apk` targets older 32-bit ARM phones.
- `kinsay-arm64-v8a.apk` targets modern 64-bit ARM phones.
- `kinsay-play-store.aab` is for Play Store distribution and cannot be installed directly.
- `kinsay-ios-unsigned.ipa` must be signed locally with SideStore or Sideloadly before it can be installed on an iPhone.

Manual workflow runs become prereleases named `Kinsay build #…`. Pushing a tag matching `v*` creates a normal versioned release using that tag.

## iOS sideloading builds

The separate **iOS unsigned build** workflow remains available for manually rebuilding `kinsay-ios-unsigned.ipa` and adding it to an existing GitHub Release. The IPA is intentionally unsigned so SideStore or Sideloadly can sign it locally with the device owner's Apple Account.

An unsigned IPA cannot be installed directly. With a free Apple Account, the locally signed application must be refreshed within Apple's seven-day provisioning window.

## Reading and appearance

The reader toolbar provides search, bookmarked messages, date navigation, and a
jump to the conversation's actual latest message. Android Back closes the active
chat tool before leaving the conversation. App settings offer light, dark, and
system themes and a default reading size; individual chats can follow that size
or override it. Phone landscape and tablet layouts use bounded reading columns.

Imports show the destination chat, new-message count, media preparation, and
recoverable ambiguities before committing. Cancel keeps the existing chat intact;
active native ZIP extraction must finish before cancellation can clean up its
files. Conflicting attachment names are reported instead of choosing a file
arbitrarily. Long-press a saved chat and choose **Repair media…** to restore
missing attachments from a matching export without replacing its messages or
bookmarks. Files whose names were reused across different retained sources need
unambiguous original-file identification and are left untouched.

## Kinsay passcode

Enable the optional lock in app settings with a separate **6–12 digit Kinsay
passcode** and confirmation. Changing or disabling it requires the existing
Kinsay passcode. Optional biometric unlock returns to the Kinsay passcode when
unavailable; the phone's PIN is never offered as an unlock method.

Verification data is salted and stored through SecureStore, and failed-attempt
delays survive restarting the app. App-switcher protection is optional; on
Android it also blocks screenshots. The lock controls access to app screens;
archive encryption and encrypted backups remain separate work.

Forgotten-passcode recovery requires confirming deletion of the local archive
before its lock can be cleared. Keep the original WhatsApp exports for reimport.
SecureStore credentials can survive reinstalling on iOS.

These changes add native modules, so install a newly built APK/IPA or development
client before testing them. Starting Expo against an older native build does not
install those modules.

## Regression checks

See [the testing guide](docs/testing.md) for pull-request verification and the
manual-only Android/iOS smoke workflow. `npm run benchmark:timeline` measures
bounded timeline merges and presentation work in local JavaScript; device frame
rates remain a separate measurement.
