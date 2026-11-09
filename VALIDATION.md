# Validation record — v1.0.0, 9 November 2026

| Check | Result | How |
|---|---|---|
| Unit tests | 53 pass | `npm test`: parsing, prediction, geodesy, routes, search, alert rules over whole flights, trips and history, the watcher and native sync, the live engine's scheduling, and the web relay (who may use it, what it forwards, CORS and `Date` exposure, refusals, upstream failure) |
| Android rules | Pass | `npm run test:android-rules`: `Rules.java` compiled with stand-ins for org.json and run on the same flights as the web rules; identical alerts, wording and tags |
| Server and proxy | Pass | Static files, airports file, path traversal, methods, and rejection of non-allowlisted, non-HTTPS and credentialed proxy targets |
| Browser, desktop and iPhone sizes | Pass (locally and on GitHub's Ubuntu runner) | Headless Chrome with software WebGL, feeds mocked: location prompt and blue dot, live through the relay, selection, route, telemetry, 3D cameras, search (airline, type, worldwide jump), saved items and alerts, trips (only the trip's planes on the map), history, map options, the plain **Sources** button and its dialog, no "demo" anywhere, panning to a new region (planes in about 1 s), and the native bridge contracts |
| Always live, no demo | Pass | The standalone `Aeris.html` opened from a file without a relay: one notice, an empty map, no demo traffic, not shown again on reload. Every source failing: one notice and a status line after 15 s; when the sources answer again the planes return and the status line clears by itself |
| iOS app in the Simulator | Pass | App launches, live data through the native bridge, location reaches the page. Self-test: asks for notification permission (the prompt appears; CI cannot tap Allow), adds a live flight to a trip, syncs it to the app, runs a background check with the rules in JavaScriptCore (1 flight checked), posts an alert; **the app keeps running throughout** |
| Real services from CI | Pass | `npm run test:live`: first aircraft in 0.5 s around Singapore, median age of on-screen positions 1.0–1.7 s; 131–153 aircraft drawn around London, 1.1–1.4 s; route checked (WJA2 YYC→LHR); 3D with geoid-corrected height; **worldwide search from London for an A380 over Australia (UAE75T → "EK 75T") answered in 0.87 s and the map went there**; "lufthansa" listed 90–94 Lufthansa flights from OpenSky's worldwide list; no page errors |
| iOS device build | Pass | Unsigned `Release-iphoneos` build packaged as IPA with background app refresh and notification code; signed export runs only when secrets exist |
| Android build | Pass | Debug APK with the network and device bridges and the background check job (not run on a device) |
| Data sources from CI | Measured | adsb.lol and adsb.fi: HTTP 200, 120–240 ms, median position age 0.3–0.5 s, **no CORS headers**. adsb.lol `/v2/type/A388`: 41 aircraft worldwide in 154 ms; adsb.fi has no type endpoint. airplanes.live: HTTP 403 from cloud IPs. OpenSky worldwide list: 7,573 aircraft in 155 ms, 4 credits. adsbdb, hexdb, Planespotters, OpenFreeMap, Esri, AWS terrain: CORS open |
| Rate limits | Adjusted | adsb.lol answered 429 after 45–70 s from GitHub's shared runner addresses even at 1.6 s spacing; Aeris backs off that source and adsb.fi carries the refresh. Behaviour from home or mobile addresses is not yet measured |

## Fixed during validation

v1.0.0:
- The standalone `Aeris.html` did not run at all: the build inlined the app with a string replacement, which expanded `$'`-like sequences in the code into pieces of the page. It now uses a function.
- World-view map labels showed empty boxes for Chinese, Japanese, Thai and similar names (the map fonts have no such glyphs); base-map labels are now in Latin script.
- A service-worker update could cache an older file from the browser's HTTP cache; installs now bypass it.

v0.5.0:
- The background check skipped flights when adsb.lol rate-limited the request; it now asks adsb.fi next.

v0.4.0:
- The live smoke test measured the age of every aircraft held in memory, including ones that had left the view a few seconds earlier and are no longer refreshed; it now measures the aircraft on screen.
- A worldwide search returned "not in the air" when the only working source was pacing itself after a 429; it now tries that source last, and says so when every source fails.
- "km flown" could read −1 when the aircraft was still behind the departure airport.

v0.3.0:

- A hidden details drawer widened the page on phones (layout viewport 740 px on a 390 px screen), making dialogs overflow. It was present before this release.
- The navigation bar shifted sideways as the live-status text changed width.
- Map layer expressions rejected by MapLibre (zoom must be the outermost input) left the aircraft layer missing.
- Polling never started when the first map style failed to load.
- At zoom levels where the view was just under 250 NM across, no request was made (the plan asked for 260 NM; sources cap at 250).
- Switching to satellite imagery in 3D removed the aircraft model, and a style change with terrain active threw an error.
- The vertical-speed caption could say "Climbing" while descending.

## Not yet verified

- The web app's relay on Cloudflare: its code is unit-tested and the Pages workflow checks live data through it after each deploy, but it runs only once the repository's Cloudflare secrets are set.

- Physical iPhone/Android devices: battery, thermal behaviour, memory on older phones, long sessions.
- Notifications and background checks on a device. The simulator cannot grant notification permission from CI, and iOS/Android decide when background checks run (15 minutes to hours apart). The alert rules themselves are unit-tested, and the crash reported on turning alerts on in v0.4.0 could not be reproduced in the simulator.
- The Android location and notification permission prompts (built, not run).
- Sideload install of the IPA through SideStore/AltStore (the build is standard; signing is done by those tools).
- The Cloudflare Worker proxy (code is included; it deploys only when Cloudflare secrets are set).
- Coverage outside regions with volunteer receivers.

## Dependency note

`npm audit` reports GHSA-jrc7-96c5-q579 for every MapLibre GL JS release up to 6.4.0: a bypass in `DOM.sanitize`. In MapLibre 5.24 that function is used only by the attribution control, which Aeris disables (credits are rendered by the app from fixed strings). Popups are not used. Aeris stays on 5.24 because 6.x loads its worker as a separate module file, which the self-contained offline file and WKWebView setup do not support yet. Revisit when moving to 6.x.
