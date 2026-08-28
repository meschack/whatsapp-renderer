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

## Android releases

The **Android release builds** GitHub Actions workflow creates signed builds for 32-bit ARM, 64-bit ARM, universal ARM, and the Play Store. Every successful run publishes these files on the repository's **Releases** page.

- `kinsay-universal-arm.apk` is the normal direct-install build for ARM Android phones.
- `kinsay-armeabi-v7a.apk` targets older 32-bit ARM phones.
- `kinsay-arm64-v8a.apk` targets modern 64-bit ARM phones.
- `kinsay-play-store.aab` is for Play Store distribution and cannot be installed directly.

Manual workflow runs become prereleases named `Kinsay build #…`. Pushing a tag matching `v*` creates a normal versioned release using that tag.
