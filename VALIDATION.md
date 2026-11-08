# Validation record — v0.4.0, 8 November 2026

| Check | Result | How |
|---|---|---|
| Unit tests | 30 pass | `npm test`: the 21 earlier tests (parsing, merging, dead reckoning, coverage circles, routes, geoid, types, live-engine scheduling, airports, demo) plus search parsing ("lufthansa" → DLH, "SQ 22"/"SQ022" → SIA22, "6E 2341" → IGO2341, registrations, hex, A380/787/737 families), alert rules (take-off, approach once, landing, emergency squawk once, probably landed, silent first look), the saved collection and migration from the old saved list, the watcher (silent baseline, quiet after resume), and worldwide lookups trying a rate-limited source last |
| Server and proxy | Pass | Static files, airports file, path traversal, methods, and rejection of non-allowlisted, non-HTTPS and credentialed proxy targets |
| Browser, desktop and iPhone sizes | Pass (locally and on GitHub's Ubuntu runner) | Headless Chrome with software WebGL, feeds mocked: first-open location question and blue dot, live mode via proxy, aircraft drawn, tap selection with flight number and airline, route and time to go, airframe and telemetry tabs, 3D follow/orbit/cockpit/model, airport search, saving an airport, "singapore" listing the airline and its flights, "A350" listing the type in the air, "LH 400" found worldwide (an aircraft far outside the view), opened, saved and alerts turned on, Saved list, map options and data sources, no page errors |
| iOS app in the Simulator | Pass | App launches, live data through the native bridge (adsb.lol and adsb.fi, 140–290 ms), **location from the simulator reaches the page through the new device bridge** (blue dot, map starts there), no script errors |
| Real services from CI | Pass | `npm run test:live`: first aircraft in 0.5 s around Singapore, median age of on-screen positions 1.0–1.7 s; 131–153 aircraft drawn around London, 1.1–1.4 s; route checked (WJA2 YYC→LHR); 3D with geoid-corrected height; **worldwide search from London for an A380 over Australia (UAE75T → "EK 75T") answered in 0.87 s and the map went there**; "lufthansa" listed 90–94 Lufthansa flights from OpenSky's worldwide list; no page errors |
| iOS device build | Pass | Unsigned `Release-iphoneos` build packaged as IPA with background app refresh and notification code; signed export runs only when secrets exist |
| Android build | Pass | Debug APK with the network and device bridges and the background check job (not run on a device) |
| Data sources from CI | Measured | adsb.lol and adsb.fi: HTTP 200, 120–240 ms, median position age 0.3–0.5 s, **no CORS headers**. adsb.lol `/v2/type/A388`: 41 aircraft worldwide in 154 ms; adsb.fi has no type endpoint. airplanes.live: HTTP 403 from cloud IPs. OpenSky worldwide list: 7,573 aircraft in 155 ms, 4 credits. adsbdb, hexdb, Planespotters, OpenFreeMap, Esri, AWS terrain: CORS open |
| Rate limits | Adjusted | adsb.lol answered 429 after 45–70 s from GitHub's shared runner addresses even at 1.6 s spacing; Aeris backs off that source and adsb.fi carries the refresh. Behaviour from home or mobile addresses is not yet measured |

## Fixed during validation

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

- Physical iPhone/Android devices: battery, thermal behaviour, memory on older phones, long sessions.
- Notifications and background checks on a device. The simulator cannot grant notification permission from CI, and iOS/Android decide when background checks run (15 minutes to hours apart). The alert rules themselves are unit-tested.
- The Android location and notification permission prompts (built, not run).
- Sideload install of the IPA through SideStore/AltStore (the build is standard; signing is done by those tools).
- The Cloudflare Worker proxy (code is included; it deploys only when Cloudflare secrets are set).
- Coverage outside regions with volunteer receivers.

## Dependency note

`npm audit` reports GHSA-jrc7-96c5-q579 for every MapLibre GL JS release up to 6.4.0: a bypass in `DOM.sanitize`. In MapLibre 5.24 that function is used only by the attribution control, which Aeris disables (credits are rendered by the app from fixed strings). Popups are not used. Aeris stays on 5.24 because 6.x loads its worker as a separate module file, which the self-contained offline file and WKWebView setup do not support yet. Revisit when moving to 6.x.
