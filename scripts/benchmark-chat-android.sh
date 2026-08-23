#!/usr/bin/env bash

set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-com.godwingbewezoun.whatsapprenderer}"
MAIN_ACTIVITY="${MAIN_ACTIVITY:-.MainActivity}"
TAP_X="${1:-}"
TAP_Y="${2:-}"
OUTPUT_DIR="${3:-benchmark-results/$(date +%Y%m%d-%H%M%S)}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"

if [[ -z "$TAP_X" || -z "$TAP_Y" ]]; then
  echo "Usage: $0 <chat-row-x> <chat-row-y> [output-directory]" >&2
  exit 2
fi

if [[ "$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')" -ne 1 ]]; then
  echo "Connect exactly one Android device with USB debugging enabled." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

adb shell am force-stop "$PACKAGE_NAME"
adb logcat -c
adb shell dumpsys gfxinfo "$PACKAGE_NAME" reset >/dev/null
adb shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" >/dev/null
sleep 3
adb shell input tap "$TAP_X" "$TAP_Y"

deadline=$((SECONDS + TIMEOUT_SECONDS))
performance_line=''

while (( SECONDS < deadline )); do
  performance_line="$(adb logcat -d -v raw ReactNativeJS:I '*:S' 2>/dev/null | grep '\[CHAT_PERF\]' | tail -1 || true)"
  if [[ -n "$performance_line" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$performance_line" ]]; then
  echo "No [CHAT_PERF] result arrived within ${TIMEOUT_SECONDS}s." >&2
  echo "Build with EXPO_PUBLIC_CHAT_BENCHMARK=1 and confirm the tap coordinates target a chat." >&2
  exit 1
fi

printf '%s\n' "$performance_line" > "$OUTPUT_DIR/chat-performance.log"
adb shell dumpsys meminfo "$PACKAGE_NAME" > "$OUTPUT_DIR/memory.txt"
adb shell dumpsys gfxinfo "$PACKAGE_NAME" > "$OUTPUT_DIR/frames.txt"
adb exec-out screencap -p > "$OUTPUT_DIR/screenshot.png"

{
  echo "App benchmark"
  printf '%s\n' "$performance_line"
  echo
  echo "Android memory"
  grep -E 'Java Heap:|Native Heap:|Graphics:|TOTAL PSS:|TOTAL RSS:' "$OUTPUT_DIR/memory.txt" || true
  echo
  echo "Android frame stats"
  grep -E 'Total frames rendered:|Janky frames:|50th percentile:|90th percentile:|95th percentile:|99th percentile:' "$OUTPUT_DIR/frames.txt" || true
} > "$OUTPUT_DIR/summary.txt"

cat "$OUTPUT_DIR/summary.txt"
echo
echo "Raw benchmark artifacts: $OUTPUT_DIR"
