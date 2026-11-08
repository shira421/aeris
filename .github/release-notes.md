Aeris shows live aircraft from community ADS-B networks on an accurate world map, with a 3D view of the selected flight.

## iPhone and iPad

Two ways to install:

1. **Home Screen web app (no tools needed).** Open [shira421.github.io/aeris](https://shira421.github.io/aeris/) in Safari, tap **Share → Add to Home Screen**, then open Aeris from the Home Screen. It runs full screen.
2. **Native app (sideload).** Download **Aeris-iOS-unsigned.ipa** and install it with [SideStore](https://sidestore.io), [AltStore](https://altstore.io) or [Sideloadly](https://sideloadly.io) using your Apple ID. With a free Apple ID the app must be refreshed every 7 days. In AltStore or SideStore you can add this source for updates: `https://github.com/shira421/aeris/releases/download/latest-build/altstore-source.json`. The native app fetches flight data directly, so it can use more data providers than the web app.

If **Aeris-iOS-signed.ipa** is present, it was signed with the repository owner's Apple certificate and installs on the devices in that provisioning profile.

## Android

Download **Aeris-Android.apk** on Android 8 or later and open it. Allow installation from your browser or Files app when asked. Each CI build uses a temporary development key, so uninstall an older build if Android refuses to update it.

## What to expect

- Live positions come from community ADS-B networks (adsb.lol, airplanes.live, adsb.fi, OpenSky). Coverage depends on their volunteer receivers, and each service's terms apply.
- Routes and airframe details come from public databases and can be wrong or out of date. Aeris checks a route against the aircraft's position and says when it does not fit.
- The 3D aircraft are original models built from each type's published dimensions, not exact airframes or liveries.
- `SHA256SUMS.txt` lists checksums for every download.
