# Nearby Places — V1 Functional Parity on the V2 Property Page

**Date:** 2026-10-08
**Status:** Approved design, pending implementation plan
**Repos:** `cheapestgo-app-v2` (most of the work), `cheapestgo-api-v2` (one endpoint)
**Reference implementation:** `cheapest-go-app/src/components/property/PropertyMapSidebarContent.tsx` and its helpers

## Goal

Bring every nearby-places capability V1's property page has to V2's property page, held to the
**Functional Parity** bar in `CONTEXT.md`: same behaviour and API surface, not same appearance.
Appearance follows the V2 property page palette (ADR-0004, light and dark).

## Today's gap

| Capability (V1) | V2 today |
|---|---|
| Interactive map with place pins | Non-interactive map, 5 unlabelled dots (`NearbySection` inline in `property-view.tsx`) |
| Photo card strip, category dropdown, 1/2/5/10 km radius | None on the property page (`poi-discovery.tsx` exists but is imported nowhere) |
| Click place → fly to it, route from hotel, drive/walk/bike times | None |
| Place details popup: photo, rating + count, call/website/maps, opening hours, Google reviews | None |
| Directions to the hotel: where-from search, locate me, travel mode switch | None |
| Trip planner: up to 11 stops, Mapbox optimized route | None |
| Weather widget, fullscreen, recenter, map style panel | None |
| Enrichment: reviews, phone, website, hours, review count, English name | Hook drops them; and api-v2 `/photos/poi` 400s without `photo_reference`, so enrichment is broken |

## Decisions

1. **Placement:** replace the current "Nearby places" section on the property page, same spot.
2. **Weather is in scope.** This reverses the "Weather widget on property page" deferral in
   `CONTEXT.md`; that entry moves out of *Deferred* as part of this work.
3. **V1's local-only "post a review / add a photo" form is not ported.** It saved to the
   viewer's `localStorage` and was shown as "Cheapest Go Reviews" though no one else could see it.
   Everything else in the popup is ported.
4. **Approach:** rebuild in V2's structure (small typed units, palette-driven styling), not a
   copy of V1's 866-line component.
5. **Out of scope:** the search-results map's places panel (`MapGemsPanel`, still a stub); the
   three duplicated Google "discover" implementations in api-v2 (`google.route`, `lib/google/places.ts`,
   `hotels.controller`).

## 1. Backend and data

### api-v2 — `GET /api/v2/photos/poi`

Logic in `src/lib/google/poi-details.ts`; the route stays thin.

| Request | Response |
|---|---|
| `photo_reference`, no `full` | Image bytes (today's fast path, unchanged) |
| `name`, `lat`, `lng` [, `placeId`, `category`] | Image bytes of the resolved place's photo, or a category-coloured SVG placeholder |
| same + `full=true` | JSON `{ name, nameEn, category, vicinity, rating, userRatingsTotal, reviews, phone, website, openingHours, source }` |

- **Resolution:** with `placeId`, Place Details directly. Without, Nearby Search
  (`radius=500`, `keyword=name`) and try the top 3 candidates in order, stopping at the first with
  a photo or reviews (V1 `tryGooglePlaces`).
- **Reviews:** Google's, at most 5.
- **Opening hours default:** transit and park places without hours get
  `{ open_now: true, weekday_text: ['Open 24 hours'] }`.
- **Rating:** absent stays `null`. Never invented.
- **Cache:** Redis, 24 h. Key `poi|{placeId}`, else `poi|{name}|{lat.toFixed(4)}|{lng.toFixed(4)}`.
  A name lookup that resolves a `place_id` also writes `poi|{place_id}`. Concurrent identical
  requests share one in-flight promise. Failed lookups are **not** cached.
- **Errors:** missing `name` (and no `photo_reference`) → 400 via `AppError`. Google
  `REQUEST_DENIED` is logged at error level.

### app-v2 — `features/hotels/hooks/useNearbyGems.ts`

- `NearbyGem` gains optional `vicinity`, `userRatingsTotal`, `reviews`, `phone`, `website`,
  `openingHours`, `translatedName`, `source`. Optional so the search-results map (same hook) is unaffected.
- Enrichment calls the fixed endpoint with `full=true`, merges those fields, drops places rated
  below 3.5, and flushes state at most every ~800 ms plus once at the end (V1 behaviour).
- New return field `error`: set when `/hotels/nearby` fails; distinct from an empty result.
- Unchanged: Stage 1 from `/hotels/nearby`, Mapbox fill-in under 5 results, typed features, abort handling.

## 2. Components

New directory `features/hotels/components/nearby/`:

| Unit | Responsibility |
|---|---|
| `NearbyExplorer.tsx` | Owns category, radius, active place, popup place, travel mode, fullscreen, directions mode, trip stops. Lays out map + strip. Replaces the inline `NearbySection` in `property-view.tsx`. Takes `coordinates`, `palette`, `hotelName`. |
| `NearbyMap.tsx` | Mapbox map: hotel pin, place pins (reuses `shared/components/map/NearbyPlaceMarker`), route layer, style from `palette.mapStyle`, recenter, `MapDetailsPanel` via `useMapDetails`. |
| `PlaceStrip.tsx` | Photo cards, category dropdown (`POI_FILTERS`), radius 1/2/5/10 km, skeleton / error+retry / empty / list states, scroll arrows. |
| `PlaceCallout.tsx` | Selected-place card on the map: name, km away, drive/walk/bike minutes, View on Maps, Details, Add to trip. |
| `PlaceDetailsModal.tsx` | Photo header, rating + count, call / website / Google Maps, grouped opening hours with open-now badge, Google reviews. Empty sections hidden. No review form. |
| `DirectionsPanel.tsx` | Get directions: where-from autocomplete, locate me, profile switch (traffic / drive / walk / bike). |
| `TripPlannerBar.tsx` | Selected stops (max 11), Optimize route, clear. |
| `WeatherChip.tsx` | Current conditions + short forecast in a map corner. |

New hooks:

| Hook | Location | Behaviour (V1 source) |
|---|---|---|
| `useMapboxDirections` | `shared/components/mapbox/hooks/` | One Directions call per profile; geometry only for the selected profile; minutes per mode (`useMapboxDirections.ts`) |
| `useOriginSearch` | `features/hotels/hooks/` | Autocomplete via api-v2 `/google/search?proximity=`, select → `/google/geocode?place_id=`, reverse geocode for locate me; passive location bias never prompts (`useGoogleSearch.ts`) |
| `useTripPlanner` | `features/hotels/hooks/` | Toggle stops (cap 11), Mapbox Optimized Trips from hotel, `roundtrip=true`, fit bounds; clears geometry when stops empty |
| `useWeather` | `features/hotels/hooks/` | api-v2 `/weather?lat=&lng=`, refresh every 15 min (`hooks/useWeather.ts`) |

### Data flow

1. `NearbyExplorer` → `useNearbyGems(coordinates, category, radius)` → strip cards + map pins.
2. Select a place → `useMapboxDirections(hotel → place, profile)` → route + times in `PlaceCallout`.
3. Directions mode → `useOriginSearch` origin → `useMapboxDirections(origin → hotel, profile)`;
   this route replaces the place route.
4. Route shown, by priority: optimized trip (if stops and result) → origin route (directions mode) → place route.

### Fullscreen

The same `NearbyExplorer` tree is rendered through a portal with body scroll locked; the map resizes
after the transition. One tree, not V1's duplicated one.

### Styling and copy

- All colours from the property page `palette` (ADR-0004); map style from `palette.mapStyle`.
- Distances in **km**, as V1 shows them (the current V2 section shows miles; this changes it).
- All strings via next-intl. Missing keys from V1's `hotels.searchResults.discovery.*`,
  `property.mapOverlay.*`, `property.poiDetails.*` are added to en/ko/ja/zh; non-English entries listed in
  `src/locales/NEEDS_NATIVE_REVIEW.md`.

### Removed

`features/hotels/components/poi-discovery.tsx`, `features/hotels/components/nearby-section.tsx` (unused).

## 3. Failure handling

Principle: **a failure never presents as "nothing nearby."**

| Failure | Behaviour |
|---|---|
| `/hotels/nearby` fails | Hook `error`; strip shows "Couldn't load nearby places" + Retry. Mapbox fill-in still runs. |
| One place's enrichment fails | Card keeps basic info; popup hides empty sections. No banner. |
| Photo fails | API serves SVG placeholder; client `onError` falls back to gradient + icon. |
| Directions fail | Callout shows "Route unavailable"; modes that succeeded still shown. |
| Trip optimisation fails / 12th stop | Inline message on the trip bar (no `alert()`). |
| Locate me denied / timeout | Inline hint in the directions panel. |
| Weather fails | Chip hidden. api-v2 mock fallback for missing key unchanged. |
| No Mapbox token / no coordinates | Section not rendered (as today). |
| Category/radius change mid-flight | All fetches take an `AbortSignal`; `isAbortError` ignored. |

## 4. Testing

TDD per slice, Vitest in both repos (+ Testing Library in app-v2).

**api-v2 — `src/__tests__/poiDetails.test.ts`** (mock `fetch`, Redis):
placeId → Details only; name → candidates in order, stop at first with photo/reviews; `full=true`
shape; 24 h default for transit/park; null rating stays null; cache hit → no Google call;
concurrent dedup → one call; failures not cached; 400 on missing name; `photo_reference` fast path unchanged.

**app-v2 — `features/hotels/__tests__/`:**
`useNearbyGems` (merge, <3.5 dropped, `error` on discover failure, abort leaves no stale results);
`useMapboxDirections` (per-profile calls, geometry for selected only, minutes mapping);
`useTripPlanner` (cap 11, geometry cleared on empty); `PlaceStrip` states and callbacks;
`PlaceDetailsModal` (empty sections hidden, no review form); `DirectionsPanel` denied hint.
Existing search-map tests must still pass.

**Real app**, per the V2 local QA recipe (app-v2 on :3001, local api-v2, playwright-core + installed
Chrome), light and dark screenshots per slice: strip with photos → route + three times → details
popup → directions from typed address → 3-stop optimised trip → weather chip → fullscreen and back.

**Gate:** `tsc --noEmit`, lint, `vitest run` clean in both repos.

## Delivery slices

Each slice is test-first, committed, and checked in the browser before the next.

1. api-v2 `/photos/poi` lookup + enriched `useNearbyGems` (with `error`).
2. `NearbyExplorer`, `NearbyMap`, `PlaceStrip`, `PlaceDetailsModal`; replace the section in `property-view.tsx`.
3. Route from hotel: `useMapboxDirections`, `PlaceCallout`.
4. Directions to hotel: `useOriginSearch`, `DirectionsPanel`.
5. Trip planner: `useTripPlanner`, `TripPlannerBar`.
6. Weather, fullscreen, recenter, map style panel; delete dead files; update `CONTEXT.md` (weather out of *Deferred*).
