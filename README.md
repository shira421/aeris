# Aeris — a closer look at flight

An original, responsive flight-explorer prototype with a Three.js aircraft viewer, an offline Singapore scenario, an optional ADS-B live-feed adapter, and a provider-backed terrain integration. Created 8 November 2026.

This is a working prototype with Android preview packaging and an installable web app. The default data is synthetic and the default 3D view is schematic. It does not unlock the Flightradar24 service. No proprietary code, private endpoints, paid datasets, aircraft models or airline logos are used.

## Open it

**Fastest:** open `dist/Aeris.html` in a current desktop browser. This is one self-contained file. The demo map, data and Three.js renderer are embedded and work without a network connection. JavaScript and WebGL must be enabled. Some in-app file previews do not execute HTML; download and open it in a browser in that case.

**Full project, including the live proxy and installable web-app metadata:** install Node.js 22 or newer, then run:

```sh
npm start
```

Open `http://localhost:4173`. The built files are included, so no package installation is needed just to run the server. The server binds to `127.0.0.1` by default. Hosting under HTTPS is needed for installation on a separate phone; localhost is suitable for local desktop testing.

The public source is [shira421/aeris](https://github.com/shira421/aeris). The Pages workflow targets [shira421.github.io/aeris](https://shira421.github.io/aeris/); first enable **Settings → Pages → Source: GitHub Actions** if the site is unavailable. Pages and the Android shell use a direct provider endpoint because they do not host the Node proxy.

## Mobile downloads

The first successful mobile workflow publishes the [v0.1.0 preview release](https://github.com/shira421/aeris/releases/tag/v0.1.0). Later builds remain available as Actions artifacts and do not overwrite the published files. It contains two downloads plus SHA-256 checksums:

- `Aeris-Android-v0.1.0.apk` targets Android 8 or newer. It uses a temporary development signature, so uninstall a previous preview before installing a build with a different signature. Production signing and Play Store distribution are not configured.
- `Aeris-iOS-WebApp-v0.1.0.zip` contains the downloadable PWA. On iPhone or iPad, the supported install flow is to open the GitHub Pages demo in Safari and choose **Share → Add to Home Screen**. This is not a signed IPA; a device-installable IPA requires an Apple Developer signing identity and provisioning profile.

The Android shell embeds the same offline web application from `dist/`, served through Android's HTTPS asset loader. Its source is under `android/`. The release workflow is in `.github/workflows/mobile-release.yml`. CSV export uses browser downloads; Android WebView download handling is not validated.

For source changes:

```sh
npm install
npm run build
npm test
npm run models
```

The dependency versions are pinned in `package.json`; Three.js r160 is vendored with its MIT licence, and its OrbitControls and GLTFExporter are included. `npm run models` exports the original aircraft meshes to GLB. The supplied assets can also be opened in Blender.

## Try these flows

1. Select **SQ228**, then **Step into the flight**. Try Orbit, Follow, Cockpit and Free camera.
2. Press Play or move the replay slider. The SQ228 scenario includes approach, touchdown and rollout.
3. Search **TR18**, reset its replay, and play the takeoff and climb scenario.
4. Use the globe button to see the selected position and a schematic demo route on Earth. Route height is exaggerated for legibility.
5. Open Telemetry. Missing indicated and true airspeed stay unavailable; they are never replaced with ground speed.
6. Star two flights, open Saved, and compare them. Selections persist on the device.
7. Open Airports and select SIN or XSP for reference dimensions and runway information.
8. Export the selected session track from Telemetry. Demo exports explicitly contain `synthetic` and scenario seconds; real reports retain their UTC timestamps.
9. Click the source badge to connect an authorised ADS-B v2 feed. A connection failure leaves an explicit error and does not relabel the demo as live.

On mobile, flight details use a drawer. In Free camera, focus the scene and use W/A/S/D, Q/E for vertical movement, and Shift for faster movement. Drag changes the view. Orbit supports touch gestures through OrbitControls. The toolbar and airport/search flows remain accessible without interacting directly with canvas markers.

## What is implemented

| Area | Current behaviour |
|---|---|
| Regional map | Offline, generalised Natural Earth-derived geography, panning, zoom, selected track, search, airport markers, labels, altitude/type filters, night palette |
| Global scene | Three.js globe, selected position, schematic demo route |
| 3D aircraft | Original parametric A350-900, A320, 787-8 and 777-300ER profiles; original neutral livery; unknown types use a clearly labelled generic model |
| Camera | Orbit, follow, reconstructed forward/cockpit view, free movement and reset |
| Scenario | 13 synthetic flights, pausable replay, 1×/4×/16×, approach/landing and takeoff/climb examples |
| Flight information | Pressure/geometric altitude distinction, ground speed, vertical speed, ground track, optional IAS/TAS/Mach/heading/roll, source timestamps |
| Consumer features | Saved flights, comparison, explanatory metric dialogs, unit preferences, honest source/age indicators and CSV track export |
| Airports | Four regional airports, runway dimensions, coordinates, local time and official links; no fabricated weather or schedules |
| Live data | ADS-B v2 parser, optional direct endpoint, same-origin fixed-provider proxy, 15-second polling, request timeout, backoff and tab-visibility handling |
| Replay | Up to 121 observed reports per aircraft and a 30-minute retention window in the current tab; no claim of a historical database |
| Mobile foundation | Responsive CSS, manifest, home-screen icons, offline service worker for app assets; installation needs an appropriate HTTPS host |
| Terrain extension | Cesium ion World Terrain and imagery; optional Google Photorealistic 3D Tiles when the user's account permits them; token held in memory |

## Accuracy: what the picture means

The demo is entirely synthetic. Real airline names illustrate the interface; registrations deliberately contain `DEMO`. Nothing in that mode claims an actual aircraft location, current schedule, delay or operating status.

The default 3D viewer is **schematic, not hyperrealistic**. It uses generalised geographic boundaries, approximate coast/ellipsoid ground, invented airport massing, illustrative clouds and lighting, and original approximate aircraft geometry. Model envelopes are checked against the reference length, span and height; that does not validate the shape of an actual airframe or its aerodynamic behaviour.

Positions are placed in a WGS84 local east/up/south frame. If GNSS/geometric altitude is missing, pressure altitude is only an approximation for placement. Ellipsoidal height, orthometric elevation and barometric altitude are different quantities. No geoid or weather-pressure correction is currently applied. If both reported altitude fields are missing, local 3D reconstruction is refused; the globe can still display the horizontal position.

Ground track is not necessarily nose heading. The reconstruction uses reported true heading when present and otherwise ground track. Pitch is estimated from vertical and horizontal motion, not measured attitude. A reported roll value is used when available. The renderer is not a flight dynamics engine, and cannot recreate true aircraft control surfaces, landing gear, braking, flare or wind response from missing data. Demo gear is inferred from the scenario; live gear is displayed only on an on-ground report.

Live extrapolation is bounded to 10 seconds from a reported position, then freezes at that bounded estimate. Positions become stale after 15 seconds and leave the active map after 60 seconds. The detail panel retains original report values and age. A stale selected scene freezes rather than inventing ongoing flight. Unknown airspeed, serial number, age, route, weather or schedule information remains unavailable.

The provider-backed terrain option improves geographic detail but does not make the aircraft telemetry or attitude exact. Imagery can be old, 3D coverage incomplete, and vertical datums inconsistent. That integration requires a user-supplied, appropriately scoped provider token and has **not been exercised against a live account in this environment**. Provider terms and metering apply.

## Validation performed

- Core tests pass for WGS84 frames, geodesic propagation including the dateline, valid/invalid coordinates, timestamp normalization, zero versus missing data, stale-position freezing, schema/URL escaping and aircraft mesh bounds.
- DOM integration checks pass for initial render, search, selection, saving, comparison, metric explanations, invalid/valid filters, airport details, missing telemetry, replay and an explicitly mocked live response. This is not a real live-feed success.
- Local server checks pass for HTML, JavaScript, CSS, manifest and service-worker delivery, path traversal rejection and unsupported methods.
- The actual map drawing code was rendered to a PNG through a native Canvas implementation and inspected. Actual aircraft triangles were also inspected using a diagnostic CPU renderer and corrected for geometry defects.
- **Full browser, mobile-device and WebGL visual QA could not be completed:** the available preview browser failed to initialize. The build and DOM checks cannot establish GPU compatibility, performance, responsive pixel layout or camera usability on a real device.
- **Live provider access was not validated:** outbound access to the tracking endpoint was blocked in the execution environment. Error handling is present; mock integration tests do not establish feed coverage or availability.

## The path to the requested production app

The next engineering milestone is a browser/device-tested vertical slice with one real flight, a permitted feed, real terrain, and a verified aircraft asset. Then add production mobile signing and larger provider coverage. See `ARCHITECTURE.md` for the data/renderer boundaries and `PRODUCT.md` for the acceptance criteria.

Do not equate removing UI paywalls with zero operating costs. Global tracking, routes, schedules, weather, elevation, imagery and high-fidelity model libraries have separate availability, licence and infrastructure requirements. The prototype does not create those entitlements.

## Research that informed the build

The interface uses a calm map-first workspace, one selected-aircraft detail panel, three detail tabs, consistent units, a single orange selection colour, and a separate immersive mode. These are design hypotheses informed by established interaction guidance; no consumer usability study was conducted.

| Evidence | Decision |
|---|---|
| [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) describes deferring advanced options to reduce the initial decision load. | Put the map and primary flight metrics first; reveal airframe detail, raw telemetry, source and display controls on demand. |
| [Flightradar24's own 3D documentation](https://flightradar24com.freshdesk.com/support/solutions/articles/3000123424-the-flightradar24-3d-view) describes aircraft/livery coverage limits and 3D access rules. | Treat model coverage and data quality as visible product states; use original assets and avoid replicating proprietary 3D content. |
| [OpenSky's API documentation](https://openskynetwork.github.io/opensky-api/rest.html) separates position time, pressure/geometric altitude, velocity over ground and true track; routes are not part of its state-vector response. | Keep reporting basis and missing fields explicit. Never manufacture a route or substitute ground speed for airspeed. |
| [ADSB.lol's API documentation](https://api.adsb.lol/docs) and [key page](https://www.adsb.lol/request) describe ODbL data and best-effort access. | Use a replaceable provider adapter and visible connection failures; do not promise unlimited production availability. |
| [Cesium flight-tracker tutorial](https://cesium.com/learn/cesiumjs-learn/cesiumjs-flight-tracker/) combines time-stamped flight positions with streamed geography. | Provide a separate terrain renderer for a real-geography path instead of presenting procedurally invented hills as accurate terrain. |
| [OurAirports open data](https://ourairports.com/data/) provides public-domain airport reference datasets. | Keep a small sourced reference catalog now; production should use a versioned import and current operational data separately. |

Additional references: [Airbus A350-900](https://www.aircraft.airbus.com/en/aircraft/a350/a350-900), [Boeing 787 dimensions](https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/787_Rev_P.pdf), [Boeing 777](https://www.boeing.com/Commercial/777), [Airbus A320neo dimensions](https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo), [CAAS Seletar AIP](https://aim-sg.caas.gov.sg/aim-content/uploads/aip/17-SEP-2026/AIP/2026-09-03-000000/html/eAIP/SG-AD-2-WSSL-en-GB.html), [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/).

## Licences and provenance

Original application code, logo and procedural aircraft: MIT, see `LICENSE`.

Three.js and the included controls/exporter: MIT, see `vendor/THREE-LICENSE.txt`. Three.js r160 was selected as a fixed vendorable build; it is not represented as the latest release. The exporter is adapted to use the local module and reject unused compressed-texture processing.

Regional geography: Natural Earth-derived DataMaps TopoJSON for Singapore, Malaysia and Indonesia; see `data/DATAMAPS-LICENSE.txt`. Global land: Natural Earth public-domain 110m data. These generalised datasets must not be used to imply current cadastral/shoreline accuracy.

LinkeDOM is included only for DOM tests, with its MIT licence in `tests/vendor`. ADSB.lol data is not bundled; if connected, its ODbL terms govern that data separately from the source-code licence. Cesium, imagery and photorealistic tiles are fetched only when the terrain option is invoked and remain subject to their provider's terms and attribution requirements.
