# Product intent and acceptance criteria

Aeris is for curious passengers, aviation enthusiasts and people watching an arrival. Its primary task is selecting an aircraft and understanding what it is doing. The design should move from recognition to detail without making the map feel like an instrument-panel wall.

The visual direction is a light cartographic workspace with restrained teal, warm orange selection, airy off-white panels and compact typography. Orange indicates the selected object or replay position. Connection state uses text as well as colour. The camera view is immersive; the information panel remains an optional companion.

The current screen starts in Singapore because that makes the sample immediately relevant and allows coherent map, airport and approach examples. It is not an assertion of worldwide live coverage.

## Acceptance boundaries

| Requirement | Current status | Production acceptance |
|---|---|---|
| Search and inspect aircraft | Implemented; DOM tested | Search permitted global data, clearly distinguish active and historical records |
| Rich telemetry | Optional fields preserved; missing values honest | Display measured IAS/TAS/Mach/wind/temperature where the contracted feed supplies them |
| Aircraft and airport detail | Four aircraft families and four reference airports | Versioned global reference catalogs; schedules/NOTAMs from appropriate current feeds |
| 3D camera | Implemented; geometry checked; browser verification outstanding | Real-device tested orbit/follow/forward/free controls; stable rendering and accessible fallbacks |
| Takeoff and landing | Synthetic scenarios | Validate measured tracks and vertical datums against actual runway geometry; label missing attitude and gear |
| Hyperreal surroundings | Optional provider integration, not exercised | Verified terrain/photogrammetry, licences, attribution, coverage and mobile performance |
| iOS/Android | Responsive web/PWA foundation | Device QA, native wrapper if required, signing and distribution |
| Paywall-independent functionality | Original code and an open-data adapter | Sustainable provider/storage/tile budgets; do not imply paid data is free |

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
