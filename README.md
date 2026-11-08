# Aeris

A live flight tracker. Search for any flight in the air worldwide; save flights, aircraft and airports; plan trips with dated flights; keep a history of the flights you take; and get alerts when a flight takes off or lands. Live positions on an OpenStreetMap world map, with routes, airframe details and a 3D view over real terrain. Runs on iPhone, iPad, Android and desktop browsers. Original code; open data.

## Install on iPhone or iPad

**Native app (recommended, full live data).** Download [`Aeris-iOS-unsigned.ipa`](https://github.com/shira421/aeris/releases/download/latest-build/Aeris-iOS-unsigned.ipa) and install it with [SideStore](https://sidestore.io), [AltStore](https://altstore.io) or [Sideloadly](https://sideloadly.io) using your Apple ID. A free Apple ID needs the app refreshed every 7 days. In AltStore or SideStore you can add this source for one-tap updates:

```
https://github.com/shira421/aeris/releases/download/latest-build/altstore-source.json
```

**Home Screen web app (no tools).** Open [shira421.github.io/aeris](https://shira421.github.io/aeris/) in Safari → Share → Add to Home Screen. See [Live data](#live-data) for what the web app needs to show real aircraft.

**Signed builds.** Add these repository secrets and every build also produces `Aeris-iOS-signed.ipa`: `IOS_CERTIFICATE_P12` (base64 .p12), `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE` (base64 .mobileprovision), optionally `IOS_TEAM_ID` and `IOS_EXPORT_METHOD` (`development`, `ad-hoc` or `app-store`).

**Android.** Download [`Aeris-Android.apk`](https://github.com/shira421/aeris/releases/download/latest-build/Aeris-Android.apk) and open it (Android 8+).

Every push to `main` rebuilds everything in GitHub Actions and updates the `latest-build` release. Each new version in `package.json` also gets a permanent `v<version>` release.

## Live data

Positions come from community ADS-B networks: [adsb.lol](https://adsb.lol), [adsb.fi](https://adsb.fi), [airplanes.live](https://airplanes.live) and the [OpenSky Network](https://opensky-network.org). These services do not send CORS headers, so **a web page cannot read them directly**. Aeris gets around this in three ways:

| Where Aeris runs | How it reaches the feeds |
|---|---|
| iOS / Android app | Native requests through a small bridge (allowlisted hosts only) |
| `npm start` on your computer | The local server's `/api/proxy` |
| GitHub Pages web app | A Cloudflare Worker proxy you deploy (free tier), or the demo |

To give the Pages web app live data: create a Cloudflare API token (Workers edit permission) and add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The Pages workflow then deploys `worker/` and builds the site to use it. You can also paste any proxy URL in the app under Data sources.

**How fresh is it?** The area on screen is refreshed about once a second, alternating sources so each stays within its published limit (1 request per second for adsb.fi and airplanes.live). Measured from GitHub's runners: 120–240 ms per request; positions typically 0.3–0.6 s old when served. Between reports Aeris dead-reckons along the reported track and turn rate for at most 20 s, blends corrections in smoothly, marks positions stale after 15 s and removes them after 60 s. Polling pauses when the app is in the background.

**Coverage** depends on volunteer receivers. Busy regions are dense; oceans and remote areas can be empty. When you move the map to a new area, Aeris requests it straight away instead of waiting for the next cycle. OpenSky is used for airline lists and as a fallback when the other sources fail (anonymous use: 400 credits a day, tracked by the app).

## What it does

- **Search** is the main way around. It understands flight numbers (`SQ 22`, `SQ22`, `SIA22`), airline names, codes and radio callsigns (`Lufthansa`, `LH`, `DLH`, `Speedbird`), registrations (`9V-SMU`, `N123AB`), aircraft types and families (`A380`, `787`, `Dreamliner`) and airports (name, city, IATA or ICAO). Anything that names one aircraft is also looked up worldwide, so a flight on the other side of the world appears in the results and the map goes to it. An airline lists all its flights in the air (from OpenSky's worldwide list); an aircraft type lists every one flying.
- **Saved:** flights (by flight number, so you can follow one before it departs), aircraft (by airframe) and airports.
- **Alerts:** for a saved flight choose *Next flight* or *Every flight* (for someone who flies the same route regularly). Each alert is sent once per flight: take-off (with the airport it left), in the air (when first seen already flying), descending into the destination, landing (with the airport), and emergency transponder codes. Alerts state only what was observed; when a flight drops out of coverage Aeris says nothing rather than guess. The apps check every minute while open and every 15 minutes or more when closed (iOS and Android decide exactly when). Browsers alert only while the page is open.
- **Trips:** a named set of flights with dates. Opening a trip shows its routes and only its planes on the map; on the day of each flight it gets alerts, and once flown it can go into your history.
- **Flight history:** flights from your trips are added after Aeris sees them land, with the take-off and landing times it saw; past flights can be added by hand. The past year (or any year) in numbers: flights, kilometres, airports, airlines, and time in the air for tracked flights, with all the routes on the map.
- **Your location:** on first open Aeris asks whether to show your position; the map then starts there.
- **Map:** MapLibre GL with OpenFreeMap vector tiles (OpenStreetMap data), satellite imagery, a night style and an optional globe. Map style and display options are in one menu on the map's right-hand toolbar. Offline fallback to bundled Natural Earth geography.
- **Aircraft:** GPU-drawn silhouettes by class, coloured by altitude, rotated to the ground track. Only the aircraft on screen are drawn; the update rate drops as the count rises.
- **Details:** flight number and airline, route checked against the aircraft's actual position (mismatched database routes are hidden), progress and time to landing, airframe photo with credit, registration, operator, dimensions, and telemetry including autopilot targets, QNH, wind and position accuracy.
- **Airports:** 6,045 airports from OurAirports with runways drawn to scale, local time and live traffic within 30 km.
- **3D:** from the *View in 3D* card in a flight's details: follow, orbit or cockpit view over real terrain and satellite imagery, plus a close-up model view. While in 3D only the selected aircraft is fetched.
- CSV export of a flight's track; feet/knots or metric units.

## Accuracy notes

- Routes come from adsbdb and hexdb, which list the usual route for a callsign. They are often stale for re-used flight numbers, so Aeris only shows a route when the aircraft is within 15% of the route length (at least 150 km) of the great-circle path, between its ends, and heading towards the destination.
- Pressure altitude is not height above sea level. The Telemetry tab shows both, with the basis used.
- Attitude is estimated: heading from the reported track or true heading, pitch from vertical and ground speed, roll when reported. The 3D models are original and match published dimensions; liveries and exact airframes are not modelled.
- Airport data is reference data, not operational status.

## Develop

```sh
npm install
npm start               # http://localhost:4173 with the live-data proxy
npm test                # unit tests and server checks
npm run test:browser    # headless Chrome at desktop and iPhone sizes, feeds mocked
npm run test:live       # real providers, tiles, routes and 3D (needs internet)
npm run test:android-rules   # Android's background alert rules give the same alerts as the web app (needs a JDK)
npm run data            # rebuild airports and the geoid grid from their sources
node scripts/build-airlines.mjs   # rebuild the airline list
npm run models          # export GLB models for common types
```

Layout: `src/live.js` (polling engine and worldwide lookups), `src/providers.js`, `src/net.js` (native bridge / proxy / fetch), `src/search.js` (what a query means: flight numbers, airlines, types, registrations), `src/collection.js` (saved items, trips, history and the alert rules), `src/rules.js` (the alert rules bundled for the iOS background check), `src/device.js` (location and notifications), `src/core.ts` (parsing, prediction, geodesy, route check), `src/worldmap.js` and `src/model-layer.js` (map and 3D), `src/types.js` and `src/aircraft.js` (type catalogue and models), `src/geo.js` (geoid), `src/airports.js`, `src/enrich.js`, `src/app.js` (UI). Native shells: `ios/` (XcodeGen, WKWebView; `DeviceBridge.swift` for location and notifications, `FlightWatcher.swift` for background checks running the web app's own rules in JavaScriptCore) and `android/` (`Rules.java`, a port of the rules checked against the web app by `npm run test:android-rules`, plus `FlightWatch.java` and `FlightCheckJob.java`). CI: `.github/workflows/`.

## Licences and credits

Application code, logo and models: MIT (`LICENSE`). Three.js r160 (MIT, vendored) and MapLibre GL JS (BSD-3-Clause). Map data © OpenStreetMap contributors via OpenFreeMap and OpenMapTiles; satellite imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community; terrain from AWS Terrain Tiles. Airports: OurAirports (public domain) with time zones from mwgg/Airports (MIT). Airlines: OpenFlights (ODbL 1.0) with corrections. Geoid: NGA EGM96 (public domain) via OSGeo proj-datumgrid. Live data under each provider's terms (adsb.lol data is ODbL 1.0). Routes and airframes: adsbdb, hexdb. Photos: Planespotters.net, credited to each photographer. Offline geography: Natural Earth and DataMaps (`data/DATAMAPS-LICENSE.txt`).
