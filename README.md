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
