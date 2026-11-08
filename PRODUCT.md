# Product intent and acceptance criteria

Aeris is for curious passengers, aviation enthusiasts and people watching an arrival. Its primary task is selecting an aircraft and understanding what it is doing. The design should move from recognition to detail without making the map feel like an instrument-panel wall.

The visual direction is a light cartographic workspace with restrained teal, warm orange selection, airy off-white panels and compact typography. Orange indicates the selected object or replay position. Connection state uses text as well as colour. The camera view is immersive; the information panel remains an optional companion.

The map opens on Singapore the first time, then remembers where you were. Live traffic works anywhere the community networks have receivers.

## Acceptance boundaries

| Requirement | Current status (v0.3.0) | Still to do |
|---|---|---|
| Search and inspect aircraft | Live worldwide from four sources; search by callsign, registration, type, operator or hex, including worldwide lookup | Historical records |
| Rich telemetry | IAS/TAS/Mach, autopilot targets, QNH, wind, OAT, accuracy, MLAT/ADS-B when broadcast | — |
| Aircraft and airport detail | ~100 types with published dimensions; registry data and photos; 6,045 airports with runways to scale and live traffic | Schedules, gates, NOTAMs, weather |
| Accurate map | OpenStreetMap vector tiles at every zoom, satellite, globe, night | Self-hosted tiles for guaranteed availability |
| 3D | Real terrain and imagery; follow, orbit, cockpit and model views; geoid-corrected height | Device performance testing; liveries |
| Latency | ~1 s refresh of the area on screen; 0.4–0.9 s data age measured in the iOS Simulator | A streaming source would need a commercial feed |
| iOS / Android | Native shells built in CI; unsigned and signed IPA; APK | Store distribution; device QA |

## Bonus features implemented

- Visible observed/synthetic/stale/unknown state and source age.
- Plain-language explanations of airspeed, ground speed, track and altitude.
- Side-by-side saved-flight comparisons.
- Portable CSV exports that preserve source class, timestamps and units.
- Offline demo and configurable rendering quality.

These features are useful differentiators for this design, not claims that no competitor offers them.

## Sensible next features, not falsely represented as built

A nearby-overhead view using opt-in location; useful arrival notifications with confidence rather than false precision; replay annotations; route/weather context; spotting logs; runway observation views; and a family-friendly learning mode. Prioritize these after interviewing consumers and validating the live data/3D vertical slice. Alerts require backend scheduling and explicit notification permissions; AR requires separate camera/heading calibration and permissions.

## Research-informed design decisions

Progressive disclosure keeps advanced telemetry and provider controls out of the initial scan. A selected aircraft remains the stable primary object across map, detail and camera modes. Labels retain units and reporting basis. On narrow screens, the detail view becomes a drawer. Reduced-motion preferences affect the viewer; a pause control is always present for replay.

Usability sessions should test finding a known flight, identifying a plane overhead, understanding a stale position, entering/exiting 3D, comparing two aircraft, and finding a runway's reference dimensions. Measure task completion and confusion about observed versus inferred data. No such consumer study has yet been conducted.
