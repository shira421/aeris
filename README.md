# Aeris — a closer look at flight

An original, responsive flight-explorer prototype with a Three.js aircraft viewer, an offline Singapore scenario, an optional ADS-B live-feed adapter, and a provider-backed terrain integration. Created 8 November 2026.

This is a substantial working prototype, not a completed replacement for Flightradar24 or a released iOS/Android app. It does not unlock the Flightradar24 service. No proprietary code, private endpoints, paid datasets, aircraft models or airline logos are used.

## Open it

**Fastest:** open `dist/Aeris.html` in a current desktop browser. This is one self-contained file. The demo map, data and Three.js renderer are embedded and work without a network connection. JavaScript and WebGL must be enabled. Some in-app file previews do not execute HTML; download and open it in a browser in that case.

**Full project, including the live proxy and installable web-app metadata:** install Node.js 22 or newer, then run:

```sh
npm start
```

Open `http://localhost:4173`. The built files are included, so no package installation is needed just to run the server. The server binds to `127.0.0.1` by default. Hosting under HTTPS is needed for installation on a separate phone; localhost is suitable for local desktop testing. This package is not publicly deployed.

## Mobile downloads

