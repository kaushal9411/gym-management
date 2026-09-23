#!/usr/bin/env bash
# Builds the real Play Store release artifact (an .aab, not an .apk — Google
# Play requires the Android App Bundle format for new apps/updates) with the
# production API URL baked in via --dart-define, so nobody has to remember
# to type it correctly by hand at release time.
#
# Requires (none of these exist on the machine this script was written on):
#   - Flutter SDK on PATH
#   - A JDK (for the release keystore's signing step, which this build
#     triggers automatically via android/app/build.gradle.kts once
#     android/key.properties exists — see key.properties.example)
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROD_API_BASE_URL="https://api.appkraft.info/api/v1"

if [ ! -f "android/key.properties" ]; then
  echo "android/key.properties not found — release build will fail signing."
  echo "See android/key.properties.example for the exact keytool command."
  exit 1
fi

echo "== Building release .aab against $PROD_API_BASE_URL =="
flutter build appbundle --release --dart-define="API_BASE_URL=$PROD_API_BASE_URL"

echo
echo "Output: build/app/outputs/bundle/release/app-release.aab"
echo "Upload this file to Play Console — not an .apk."
