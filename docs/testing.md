# Regression checks

Pull requests run `.github/workflows/verify.yml`: locked dependency installation,
TypeScript, Expo ESLint, and the Vitest suite. The installation explicitly
includes development dependencies even if an environment sets `NODE_ENV` to
production. The existing Node-only postinstall patch applies the checked-in
FlashList source corrections before TypeScript runs.

Run the same checks without a device:

```sh
npm ci --include=dev
npx tsc --noEmit
npm run lint
npm test
npm run test:passcode-native
```

The passcode check compiles the production Java derivation helper on Linux
(JDK required), or the production CommonCrypto Swift helper on macOS (Xcode
required). It checks reference vectors at both 600,000 and 1,000,000 rounds and
rejects unsafe parameters. Release CI runs both platform checks. These checks
do not start an emulator or simulator, and their timings are not device timings.

Lock provider regressions check that enabling preview protection preserves the
mounted screen and that the lock form centers through native styles without
depending on CSS utilities. Test passcode speed and keyboard behavior again
on a fresh native build on your phone.

## Native smoke runs

`.github/workflows/native-smoke.yml` is **manual only**. Open GitHub Actions,
choose **Native smoke (opt-in)**, then select Android, iOS, or both. No emulator,
simulator, Maestro session, or native build was started while adding this
workflow. Native execution remains unverified until a later CI/device run.

The workflow builds Release applications with bundled JavaScript. There is no
Metro server or Expo Go dependency. Android uses a disposable API 35 x86_64
emulator; iOS uses a disposable iPhone simulator on the pinned Xcode runner.
The simulator app is unsigned, and the Android E2E release uses the generated
local signing setup. Neither job requires a store signing key or publishes an
application. E2E artifacts are test applications, not distribution releases.

Both build flags must be set:

```sh
E2E_BUILD=1 EXPO_PUBLIC_E2E=1 npx expo prebuild --clean
```

The build config gives Android and iOS the isolated identifier
`com.godwingbewezoun.whatsapprenderer.e2e`. The public flag enables fixture
controls only in the explicitly isolated test build. Regular application builds
must leave both flags unset. The first test launch prepares fixture archive
files; the flow imports them through the production import/review/database path.
It does not prepopulate a bypassed database.

The pure `createE2EExportFixtures()` utility returns initial/update ZIP bytes as
`Uint8Array`, archive names, and expected counts/anchors. The initial export has
1,560 messages over 26 dates; the update shares the same history and adds 120
messages. A real inline PNG exercises indexing and image viewing. An omitted
Opus attachment exercises the missing-media path; the smoke does not claim to
verify audio playback. ZIP entry dates and generated transcript timestamps are
fixed, and fixture tests verify byte stability and production history matching.

`e2e/native-smoke.yaml` covers review/accept, chat opening, traversing 960 records
(more than six 100-record pages), latest-message navigation, search/jump,
bookmark creation/jump, calendar navigation, image viewing, Android hardware
Back, process restart/read-position restoration, history updates, and app
appearance persistence. Screenshots provide visual evidence for the later
native run; selected-state assertions verify persisted theme choice, not pixel
colors. Native crashes and command failures fail the job.

The workflow uploads JUnit results, Maestro command logs/screenshots, Android
logcat, and iOS build/simulator logs for seven days. Open these artifacts when a
step fails; a green unit-test run is not a substitute for a green native run.

## Maestro setup and device testing later

The workflow pins [Maestro CLI 2.11.0](https://github.com/mobile-dev-inc/maestro/releases/tag/cli-2.11.0)
using the [official versioned installer](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli/update-the-maestro-cli).
Install that version on a machine where you intentionally want device tests:

```sh
export MAESTRO_VERSION=2.11.0
curl -fsSL https://get.maestro.mobile.dev -o /tmp/install-maestro.sh
bash /tmp/install-maestro.sh
export PATH="$HOME/.maestro/bin:$PATH"
```

After installing the E2E application on an already running supported target,
run the flow explicitly:

```sh
maestro --device DEVICE_ID test \
  --format junit --output artifacts/results.xml \
  --debug-output artifacts/maestro --test-output-dir artifacts/maestro \
  e2e/native-smoke.yaml
```

The flow clears **the isolated E2E app's** data at its start. It restarts without
clearing data for persistence checks. Use an Android device/emulator or an iOS
simulator supported by Maestro; this workflow does not establish physical iOS
device support. See the official [device targeting](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/specify-and-start-devices),
[CLI options](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options),
[artifact options](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts),
and [Android runner](https://github.com/ReactiveCircus/android-emulator-runner)
documentation.

## Accessibility selector contract

Most flow actions use the app's existing accessible names. Keep the following
IDs stable when changing their components:

| ID                                                    | Meaning                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| `e2e-import-initial`, `e2e-import-update`             | Guarded buttons importing generated export files    |
| `import-review-confirm`                               | Accept the computed import/update plan              |
| `chat-row-e2e`                                        | The single fixture chat, including after its update |
| `chat-search-input`                                   | Search query field                                  |
| `message-actions-dismiss`                             | Dismiss the message action sheet after bookmarking  |
| `app-settings-button`, `app-settings-close`           | Open/close app settings                             |
| `app-theme-selected-light`, `app-theme-selected-dark` | The currently selected theme option                 |

Message assertions use deterministic `E2E message NNNN` anchors through normal
bubble/search/bookmark accessibility labels. Calendar assertions use ISO local
day labels with message counts. Avoid making the smoke pass by adding hidden
synthetic success labels; assertions should describe rendered app state.
