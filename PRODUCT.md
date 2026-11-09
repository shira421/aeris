# Product intent and acceptance criteria

Aeris is for two groups: aviation enthusiasts, and people following their own flight or someone else's. Both mostly arrive with a name in mind (a flight number, an airline, an aircraft type, an airport), so search is the main way around, and anything found can be saved and followed with alerts.

The visual direction is a light cartographic workspace with restrained teal, warm orange selection and off-white panels. The screen carries only the search box, the map, the map toolbar and the details panel. Text is plain: short labels, no slogans or wordplay. Connection state uses text as well as colour.

The map opens on Singapore the first time (or on your position, if you allow it), then remembers where you were. Live traffic works anywhere the community networks have receivers.

## Acceptance boundaries

| Requirement | Current status (v1.0.0) | Still to do |
|---|---|---|
| Search | Flight numbers (IATA or ICAO), airline names/codes/callsigns (1,043 airlines), registrations, hex, aircraft families and types, airports; worldwide lookups; airline and type lists | Scheduled (not yet departed) flights, historical records |
| Saved and alerts | Flights, aircraft and airports; alerts once per flight (take-off, in the air, descending into the destination, landing, emergency codes) for the next flight or every flight; only observed facts; background checks in the iOS and Android apps | Push from a server for exact timing; departure-gate and delay data |
| Trips and history | Trips of dated flights with their routes and only their planes on the map, alerts on the day; history logged from tracked flights or added by hand, with yearly numbers and a route map | Schedules for flights not yet departed; import from booking emails |
| Rich telemetry | IAS/TAS/Mach, autopilot targets, QNH, wind, OAT, accuracy, MLAT/ADS-B when broadcast | — |
| Aircraft and airport detail | ~100 types with published dimensions; registry data and photos; 6,045 airports with runways to scale and live traffic | Schedules, gates, NOTAMs, weather |
| Accurate map | OpenStreetMap vector tiles at every zoom, satellite, globe, night | Self-hosted tiles for guaranteed availability |
| 3D | Real terrain and imagery; follow, orbit, cockpit and model views; geoid-corrected height | Device performance testing; liveries |
| Latency | ~1 s refresh of the area on screen; 0.4–0.9 s data age measured in the iOS Simulator | A streaming source would need a commercial feed |
| iOS / Android | Native shells built in CI; unsigned and signed IPA; APK | Store distribution; device QA |

## Bonus features implemented

- Visible observed/synthetic/stale/unknown state and source age.
- Plain-language explanations of airspeed, ground speed, track and altitude.
- Portable CSV exports that preserve timestamps and units.
- Always live: no demo traffic. When live data cannot be reached, say so once and keep trying.

These features are useful differentiators for this design, not claims that no competitor offers them.

## Sensible next features, not falsely represented as built

Schedules and delays for flights that have not departed (needs a schedule data source); server push so alerts arrive on time even when the phone delays background checks; route/weather context; spotting logs; and a nearby-overhead view using the location the app already has. Background checks run when iOS or Android allows them, which can be every 15 minutes to a few hours; the app says so instead of promising more.

## Research-informed design decisions

Progressive disclosure keeps advanced telemetry and provider controls out of the initial scan. A selected aircraft remains the stable primary object across map, detail and camera modes. Labels retain units and reporting basis. On narrow screens, the detail view becomes a drawer. Reduced-motion preferences are respected.

Usability sessions should test finding a known flight by flight number and by airline name, saving it and turning on alerts, identifying a plane overhead, understanding a stale position, and entering/exiting 3D. Measure task completion and confusion about observed versus inferred data. No such consumer study has yet been conducted.
