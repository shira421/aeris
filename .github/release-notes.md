Aeris is a live flight tracker for iPhone, Android and the web. Search for any flight in the air worldwide by flight number, airline, aircraft type or registration; save flights, aircraft and airports; plan trips and keep a history of the flights you take; and get alerts when a flight takes off, descends into its destination, lands or squawks an emergency code.

## iPhone and iPad

Two ways to install:

1. **Home Screen web app (no tools needed).** Open [shira421.github.io/aeris](https://shira421.github.io/aeris/) in Safari, tap **Share → Add to Home Screen**, then open Aeris from the Home Screen. It runs full screen and reads live data through the Aeris relay.
2. **Native app (sideload).** Download **Aeris-iOS-unsigned.ipa** and install it with [SideStore](https://sidestore.io), [AltStore](https://altstore.io) or [Sideloadly](https://sideloadly.io) using your Apple ID. With a free Apple ID the app must be refreshed every 7 days. In AltStore or SideStore you can add this source for updates: `https://github.com/shira421/aeris/releases/download/latest-build/altstore-source.json`. The native app fetches flight data directly, so it can use more data providers than the web app.

If **Aeris-iOS-signed.ipa** is present, it was signed with the repository owner's Apple certificate and installs on the devices in that provisioning profile.

## Android

Download **Aeris-Android.apk** on Android 8 or later and open it. Allow installation from your browser or Files app when asked. Each CI build uses a temporary development key, so uninstall an older build if Android refuses to update it.

## What to expect

- Always live: there is no demo mode. Live positions come from community ADS-B networks (adsb.lol, airplanes.live, adsb.fi, OpenSky); coverage depends on their volunteer receivers, and each service's terms apply. If live data cannot be reached, Aeris says so once and keeps trying.
- The web app and `Aeris.html` read the feeds through the Aeris relay (a Cloudflare Worker), because browsers may not read them directly. `Aeris-WebApp.zip` is the same web app for hosting elsewhere; add your site to the relay's `ALLOWED_ORIGINS`.
- Routes and airframe details come from public databases and can be wrong or out of date. Aeris checks a route against the aircraft's position and says when it does not fit.
- Alerts are sent once per flight and say only what was seen. The iPhone and Android apps check every minute while open and in the background every 15 minutes or more (the phone decides exactly when), so an alert can arrive late when the app is closed. The web app alerts only while it is open.
- The 3D aircraft are original models built from each type's published dimensions, not exact airframes or liveries.
- `SHA256SUMS.txt` lists checksums for every download.
