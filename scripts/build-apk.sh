#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ARCH="$(uname -m)"
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  echo "AAPT2 from this Android Gradle Plugin is x86-64 only. Build on an x86_64 host or use GitHub Actions." >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "Set JAVA_HOME to a JDK 17 installation." >&2
  exit 1
fi

if ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "17'; then
  echo "JAVA_HOME must point to JDK 17." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "Set ANDROID_HOME or ANDROID_SDK_ROOT to an Android SDK." >&2
  exit 1
fi

accept_sdk_licenses() {
  local sdkmanager="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}/cmdline-tools/latest/bin/sdkmanager"
  if [[ ! -x "$sdkmanager" ]]; then
    sdkmanager="$(command -v sdkmanager || true)"
  fi
  if [[ -z "$sdkmanager" || ! -x "$sdkmanager" ]]; then
    echo "sdkmanager was not found in the Android SDK." >&2
    return 1
  fi
  set +e
  set +o pipefail
  yes | "$sdkmanager" --licenses >/dev/null 2>&1
  local sdk_status=${PIPESTATUS[1]}
  set -o pipefail
  set -e
  if [[ "$sdk_status" -ne 0 ]]; then
    echo "Failed to accept Android SDK licenses." >&2
    return "$sdk_status"
  fi
}

accept_sdk_licenses

value_from_properties() {
  [[ -f local.properties ]] || return 0
  sed -n "s/^$1=//p" local.properties | head -n 1
}

supabase_url="${SUPABASE_URL:-$(value_from_properties SUPABASE_URL)}"
supabase_key="${SUPABASE_ANON_KEY:-$(value_from_properties SUPABASE_ANON_KEY)}"
if [[ -z "$supabase_url" || "$supabase_url" == *YOUR_PROJECT_REF* || -z "$supabase_key" || "$supabase_key" == *YOUR_SUPABASE* ]]; then
  echo "Set SUPABASE_URL and SUPABASE_ANON_KEY in local.properties or environment." >&2
  exit 1
fi

GRADLE_BIN="${GRADLE_BIN:-gradle}"
"$GRADLE_BIN" testDebugUnitTest assembleDebug assembleRelease --stacktrace

debug_apk="app/build/outputs/apk/debug/app-debug.apk"
release_apk="$(ls app/build/outputs/apk/release/app-release*.apk 2>/dev/null | head -n 1 || true)"
[[ -f "$debug_apk" ]] && echo "Debug APK: $ROOT_DIR/$debug_apk"
[[ -n "$release_apk" && -f "$release_apk" ]] && echo "Release APK: $ROOT_DIR/$release_apk"

if [[ "${1:-}" == "--install" ]]; then
  command -v adb >/dev/null || { echo "adb is required for --install." >&2; exit 1; }
  adb install -r "$debug_apk"
fi
