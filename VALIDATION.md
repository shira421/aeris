# Validation record — 8 November 2026

| Check | Result | Scope |
|---|---|---|
| Build | Pass | Self-contained HTML and multi-file static distribution |
| Core tests | 10 passed, 0 failed | WGS84/local frames, dateline motion, missing/zero fields, source timestamps, stale prediction, invalid inputs, regional geometry, model bounds and takeoff/landing scenarios |
| DOM integration | Pass | Search, selection, saved flights, comparison, definitions, filter validation, airport detail, telemetry, replay, mocked live transition and demo restoration |
| Server checks | Pass | HTML/JS/CSS/manifest/service worker routes, path traversal rejection, unsupported methods |
| GLB containers | Pass | Four GLB 2.0 binary containers with embedded mesh geometry; not a full Khronos validator run |
| Map pixels | Inspected | Actual map drawing code rendered through native Canvas; not a browser screenshot |
| Aircraft geometry | Inspected | Actual triangle geometry through diagnostic CPU rendering; does not validate WebGL lighting |
| Full browser/GPU UI | Not completed | Preview browser failed to initialize in the environment |
| Mobile physical devices | Not completed | No physical device testing available |
| Actual live feed | Not validated | Execution-environment network access blocked the provider endpoint; mock tests are explicitly marked |
| Cesium/photorealistic terrain | Not validated | No provider credentials/account were supplied |
| Android wrapper | Source added; cloud build pending | The WebView shell and Gradle project require an Android SDK runner; this workspace has no Android SDK |
| iOS distribution | PWA package only | GitHub Pages supports Safari Add to Home Screen; no signed IPA can be produced without Apple signing credentials |

Run `npm install`, then `npm test` to rebuild and repeat automated checks. The DOM tests use LinkeDOM and native Canvas; they are not Playwright or browser visual tests. The three-dimensional scene still requires desktop/mobile browser testing before production claims are appropriate.
