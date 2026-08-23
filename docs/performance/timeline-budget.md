# Timeline memory budget and Android benchmark

The chat timeline uses a bounded, bidirectional window. Its page size and retained message count are selected from measured memory capacity rather than a device model name.

## Budget policy

The app reads total physical memory and, on Android, the per-app VM ceiling through [`expo-device`](https://docs.expo.dev/versions/v55.0.0/sdk/device/). A lower signal always wins. Unknown or incomplete capacity stays on the balanced budget.

| Tier        | Measured capacity                                              | Page size | Retained messages |
| ----------- | -------------------------------------------------------------- | --------: | ----------------: |
| Constrained | Total memory below 3 GiB, or VM ceiling at most 256 MiB        |        50 |               300 |
| Balanced    | Capacity is incomplete, or falls between constrained and roomy |        75 |               450 |
| Roomy       | Total memory at least 6 GiB and VM ceiling above 512 MiB       |       100 |               600 |

Every tier retains six pages. This keeps navigation behavior consistent while bounding the amount of message and media presentation state held at once. Keyset paging and opposite-edge trimming remain unchanged, so changing the budget does not introduce offset drift or unbounded growth.

The policy intentionally does not inspect manufacturer or model. Model and OS values are logged only to identify benchmark results.

## Running the benchmark

Build a release with instrumentation enabled:

```bash
cd android
EXPO_PUBLIC_CHAT_BENCHMARK=1 NODE_ENV=production \
  ./gradlew :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a
```

Install it as an upgrade, then run the harness with coordinates inside a representative chat row:

```bash
adb install --no-streaming -r android/app/build/outputs/apk/release/app-release.apk
npm run benchmark:android -- 320 245 benchmark-results/infinix-armel
```

The harness launches the app, opens the selected chat, waits for the FlashList benchmark, and captures:

- initial render and page-load durations;
- average/minimum/maximum JavaScript FPS;
- sampled slow and frozen JavaScript frames;
- Android rendered and janky frame statistics;
- Java, native, graphics, PSS, and RSS memory data;
- raw logs and a final screenshot.

## Infinix X657B results

Measured on 2026-08-23 using Android 10 and the `armeabi-v7a` release. The device reported 1,922,801,664 bytes of physical memory and a 134,217,728-byte per-app VM ceiling, selecting the constrained 50/300 budget.

| Chat        | Initial render | Initial page | Older page | Java heap | Native heap | Graphics | Android janky frames |
| ----------- | -------------: | -----------: | ---------: | --------: | ----------: | -------: | -------------------: |
| Armel       |          77 ms |        64 ms |     145 ms |  13.1 MiB |    27.4 MiB | 19.4 MiB |     49 / 195 (25.1%) |
| Frère Adoré |          78 ms |        68 ms |   1,260 ms |  11.6 MiB |    25.9 MiB | 17.7 MiB |     44 / 157 (28.0%) |

Both representative imported chats completed the automated scroll benchmark without a crash, data loss, or broken scroll anchors. The retained-message ceiling is half the previous fixed 600-message window on this device.

The frame results are still poor, and the second chat produced one slow older-page sample. Those are recorded as follow-up performance evidence rather than hidden by averaging. This issue bounds device memory pressure and establishes a repeatable measurement loop; it does not claim to eliminate all row-rendering jank.
