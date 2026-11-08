# Validation record — v0.3.0, 8 November 2026

| Check | Result | How |
|---|---|---|
| Unit tests | 21 pass | `npm test`: parsing (readsb, OpenSky), merging, dead reckoning with turns, staleness limits, coverage circles (no gaps over Europe, North America, Asia–Pacific), great-circle routes across the antimeridian, route check, EGM96 geoid values, altitude basis, type catalogue, model dimensions for 12 types, live-engine scheduling and rate spacing, airport data, demo scenarios |
| Server and proxy | Pass | Static files, airports file, path traversal, methods, and rejection of non-allowlisted, non-HTTPS and credentialed proxy targets |
| Browser, desktop and iPhone sizes | Pass locally; CI run pending | Headless Chrome with software WebGL, feeds mocked: live mode via proxy, aircraft drawn, tap selection, route shown and checked, airframe and telemetry tabs, 3D follow/orbit/cockpit/model, airport search with runways to scale, dialogs, filters, demo switch, no page errors |
| iOS app in the Simulator | Pass (iPhone 17 Pro, Xcode 16.4) | App launches, loads the bundled web app, real OpenStreetMap tiles render, **61–65 live aircraft around Singapore through the native bridge**, requests 116–176 ms, displayed data 0.4–0.9 s old |
| iOS device build | Pass | Unsigned `Release-iphoneos` build packaged as IPA; signed export runs only when secrets exist (not exercised: no certificate configured) |
| Android build | Pass | Debug APK with the native network bridge (not run on a device) |
| Data sources from CI | Measured | adsb.lol and adsb.fi: HTTP 200, 120–240 ms, median position age 0.3–0.5 s, **no CORS headers**. airplanes.live: HTTP 403 from cloud IPs. OpenSky: works, CORS limited to its own site. adsbdb, hexdb, Planespotters, OpenFreeMap, Esri, AWS terrain: CORS open |
| Rate limits | Adjusted | adsb.lol answered 429 after ~45 s at 0.5 requests/s from a shared runner; its spacing is now 1.6 s. Back-off is exponential per source |

## Fixed during validation

- A hidden details drawer widened the page on phones (layout viewport 740 px on a 390 px screen), making dialogs overflow. It was present before this release.
- The navigation bar shifted sideways as the live-status text changed width.
- Map layer expressions rejected by MapLibre (zoom must be the outermost input) left the aircraft layer missing.
- Polling never started when the first map style failed to load.

## Not yet verified

- Physical iPhone/Android devices: battery, thermal behaviour, memory on older phones, long sessions.
- Sideload install of the IPA through SideStore/AltStore (the build is standard; signing is done by those tools).
- The Cloudflare Worker proxy (code is included; it deploys only when Cloudflare secrets are set).
- Coverage outside regions with volunteer receivers.

## Dependency note

`npm audit` reports GHSA-jrc7-96c5-q579 for every MapLibre GL JS release up to 6.4.0: a bypass in `DOM.sanitize`. In MapLibre 5.24 that function is used only by the attribution control, which Aeris disables (credits are rendered by the app from fixed strings). Popups are not used. Aeris stays on 5.24 because 6.x loads its worker as a separate module file, which the self-contained offline file and WKWebView setup do not support yet. Revisit when moving to 6.x.
