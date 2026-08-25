# Hotel Map Pins Use Viewport Culling, Not Clustering, to Bound Marker Count

**Date:** 2026-08-25
**Status:** Accepted

## Context

The search page's hotel pins (`src/shared/components/mapbox/SearchMapContainer.tsx`) render as one `mapboxgl.Marker` plus one React `createRoot()` per hotel, created imperatively rather than through a Mapbox GL layer — a workaround for `react-map-gl`'s `<Marker>` silently failing to paint after a style change. That approach doesn't scale for free: mapbox-gl repositions every mounted marker's DOM element on every pan/zoom frame regardless of whether it's on screen, so a large result set (100+ hotels) costs real frame time even when most pins are off-screen. `CONTEXT.md`'s confirmed Phase 1 scope lists clustering as the map feature that groups nearby pins — but the client asked us to solve this specific performance problem without reaching for it here.

## Decision

Bound the mounted marker count with **viewport culling** instead: only hotels within the map's current bounds, padded by 50% of the viewport's pixel width/height, get a live marker. The set recomputes on `moveend` only, never mid-drag, so panning itself pays no extra cost — new markers simply appear once the pan settles. Hovering a rail card for a hotel outside that padded area is a no-op: the marker genuinely doesn't exist yet, and the map does not pan to reveal it.

This pairs with three smaller changes to the same imperative-marker code:

- Hover no longer re-renders every mounted marker. Previously `hoveredId` sat in the create/remove effect's dependency array, so any hover change re-ran a full loop over every marker. It's now a dedicated effect that touches only the previously- and newly-hovered marker via direct map lookups.
- Marker elements get a static `will-change: transform`. This is only safe as an always-on property because culling now bounds how many exist at once — applying it to an unbounded marker count risks the "too many GPU layers" anti-pattern.
- Creating more than 30 markers in one pass (the initial city-wide fit, or "See all in {city}" dropping the district filter) stages the rest across `requestAnimationFrame`, 15 per frame, rather than `requestIdleCallback`, which Safari/iOS does not support.

## Consequences

- Clustering remains the documented, in-scope Phase 1 feature (`CONTEXT.md`). This decision does not replace or defer it — it solves a narrower problem (marker-count performance) without it, per the client's specific request for this task.
- The visible marker count can legitimately differ from the search result count while panning. A future reader seeing fewer pins than results should look here, not assume a bug.
- Selecting a hotel is unaffected: its imperative marker is already hidden in favor of `SelectedPropertyPopup`'s own pin, regardless of whether it falls inside or outside the culled bounds.
