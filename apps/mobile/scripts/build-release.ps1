#requires -version 5.1
<#
  Builds the real Play Store release artifact (an .aab, not an .apk -
  Google Play requires the Android App Bundle format for new apps/updates)
  with the production API URL baked in via --dart-define, so nobody has to
  remember to type it correctly by hand at release time.

  Requires (none of these exist on the machine this script was written on):
    - Flutter SDK on PATH
    - A JDK (for the release keystore's signing step, which this build
      triggers automatically via android/app/build.gradle.kts once
      android/key.properties exists - see key.properties.example)
#>

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$prodApiBaseUrl = "https://api.appkraft.info/api/v1"

if (-not (Test-Path "android/key.properties")) {
    Write-Host "android/key.properties not found - release build will fail signing."
    Write-Host "See android/key.properties.example for the exact keytool command."
    exit 1
}

Write-Host "== Building release .aab against $prodApiBaseUrl =="
flutter build appbundle --release --dart-define="API_BASE_URL=$prodApiBaseUrl"

Write-Host ""
Write-Host "Output: build/app/outputs/bundle/release/app-release.aab"
Write-Host "Upload this file to Play Console - not an .apk."
