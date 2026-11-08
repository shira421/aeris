# Aeris — a closer look at flight

Live aircraft worldwide on an accurate OpenStreetMap world map, with routes, airframe details and a 3D view over real terrain. Runs on iPhone, iPad, Android and desktop browsers. Original code; open data.

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

**Coverage** depends on volunteer receivers. Busy regions are dense; oceans and remote areas can be empty. Zoomed out beyond what the 250 NM point queries can refresh, OpenSky fills in (anonymous use: 400 credits a day, tracked by the app).

## What it does

- **Map:** MapLibre GL with OpenFreeMap vector tiles (OpenStreetMap data) at every zoom level, satellite imagery, a night style and a globe view. Offline fallback to bundled Natural Earth geography.
- **Aircraft:** GPU-drawn silhouettes by class (wide-body, four-engine, narrow-body, regional, turboprop, business, light, helicopter, ground), coloured by altitude, rotated to the ground track.
- **Details:** route checked against the aircraft's actual position and heading (mismatched database routes are hidden, not shown), progress along the route, airframe photo with photographer credit, registration, operator, owner, year built, published dimensions, telemetry including autopilot targets, QNH, wind, outside air temperature and position accuracy.
- **Search:** callsign, registration, type, operator or airport; "Find worldwide" queries every live source for a flight anywhere.
- **Airports:** 6,045 airports from OurAirports with runways drawn to scale, local time and live traffic within 30 km.
- **3D:** follow, orbit or cockpit view over real terrain (AWS Terrain Tiles) and satellite imagery, plus a close-up model view. Height comes from GNSS altitude corrected with the EGM96 geoid where reported, otherwise QNH-corrected pressure altitude.
- **Models:** about 100 ICAO types with published length, span and height and their layout: engine count and position, wing height, T-tail, propellers, upper deck, rotorcraft. Unknown types use a model of the reported size category.
- Saved flights, comparison, session replay, CSV export, metric or aviation units, demo scenario.

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
npm run data            # rebuild airports and the geoid grid from their sources
npm run models          # export GLB models for common types
```

Layout: `src/live.js` (polling engine), `src/providers.js`, `src/net.js` (native bridge / proxy / fetch), `src/core.ts` (parsing, prediction, geodesy, route check), `src/worldmap.js` and `src/model-layer.js` (map and 3D), `src/types.js` and `src/aircraft.js` (type catalogue and models), `src/geo.js` (geoid), `src/airports.js`, `src/enrich.js`, `src/app.js` (UI). Native shells: `ios/` (XcodeGen, WKWebView) and `android/`. CI: `.github/workflows/`.

## Licences and credits

Application code, logo and models: MIT (`LICENSE`). Three.js r160 (MIT, vendored) and MapLibre GL JS (BSD-3-Clause). Map data © OpenStreetMap contributors via OpenFreeMap and OpenMapTiles; satellite imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community; terrain from AWS Terrain Tiles. Airports: OurAirports (public domain) with time zones from mwgg/Airports (MIT). Geoid: NGA EGM96 (public domain) via OSGeo proj-datumgrid. Live data under each provider's terms (adsb.lol data is ODbL 1.0). Routes and airframes: adsbdb, hexdb. Photos: Planespotters.net, credited to each photographer. Offline geography: Natural Earth and DataMaps (`data/DATAMAPS-LICENSE.txt`).
