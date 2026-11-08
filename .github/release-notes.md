Aeris is an original flight explorer preview with an offline Singapore scenario, Three.js aircraft cameras, and optional live ADS-B integration.

## Android

Download **Aeris-Android-v0.1.0.apk** on Android 8 or later and open it. Allow installation from the browser or Files app when Android requests it. The offline demo is bundled. A current Android System WebView with WebGL support is required.

This is a development-signed testing APK. Each CI build uses a temporary development key. Uninstall a previous preview before installing a differently signed build. Existing release files are not overwritten. Production signing and physical-device testing are still pending.

## iPhone and iPad

Once Pages is enabled, open [Aeris](https://shira421.github.io/aeris/) in Safari, then choose **Share → Add to Home Screen**. The included **Aeris-iOS-WebApp-v0.1.0.zip** contains the web-app files for HTTPS hosting; opening that ZIP does not install an iPhone app. No signed IPA, TestFlight or App Store distribution is included.

## What to expect

- Default data and flight scenarios are synthetic; the 3D scene is schematic.
- Optional live traffic depends on provider availability, coverage and browser access. Photoreal terrain requires a provider token and is unverified.
- Automated core, DOM and server checks run before packaging. Physical Android/iOS and browser GPU testing remain outstanding.
- CSV export is supported in browsers; Android WebView download handling has not been validated.
- SHA256SUMS.txt contains checksums for both downloads.
