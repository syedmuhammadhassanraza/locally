# PowerShell script to build the Rozgo APK using Capacitor and Gradle

$ErrorActionPreference = 'Stop'

Write-Output 'Step 1: Copying latest web assets...'
if (-not (Test-Path 'www')) {
    New-Item -ItemType Directory -Force -Path 'www'
}
Copy-Item 'index.html' -Destination 'www\index.html' -Force

Write-Output 'Step 2: Syncing Capacitor project...'
npx cap sync

Write-Output 'Step 3: Setting Android Environment Variables...'
$env:ANDROID_HOME = 'C:\Users\Computer\OneDrive\Documents\ANTI HACKATHON\local-sdk'
$env:ANDROID_SDK_ROOT = 'C:\Users\Computer\OneDrive\Documents\ANTI HACKATHON\local-sdk'

# Point JAVA_HOME to compatible JDK 17
$env:JAVA_HOME = 'C:\Program Files (x86)\Android\openjdk\jdk-17.0.14'
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

Write-Output 'Step 4: Compiling APK using Gradle wrapper...'
Set-Location -Path 'android'
.\gradlew.bat assembleDebug

Write-Output 'Step 5: Verifying built APK...'
$apkSource = 'app\build\outputs\apk\debug\app-debug.apk'
$apkDestWorkspace = '..\app-debug.apk'
$apkDestArtifacts = 'C:\Users\Computer\.gemini\antigravity\brain\7d6e27ba-d6e5-4761-a79b-459e2f58a30d\app-debug.apk'

if (Test-Path $apkSource) {
    Copy-Item $apkSource -Destination $apkDestWorkspace -Force
    Copy-Item $apkSource -Destination $apkDestArtifacts -Force
    Write-Output '--------------------------------------------------------'
    Write-Output '✓ APK Build Succeeded!'
    Write-Output "✓ Workspace APK location: $apkDestWorkspace"
    Write-Output "✓ Artifacts APK location: $apkDestArtifacts"
    Write-Output '--------------------------------------------------------'
} else {
    Write-Error "Failed to locate compiled APK at $apkSource"
}
Set-Location -Path '..'
