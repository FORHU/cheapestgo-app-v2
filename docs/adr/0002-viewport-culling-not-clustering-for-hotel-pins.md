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

## Update — 2026-09-02: superseded by clustering

Clustering has landed, so the culling this ADR describes is gone. That is the outcome this decision named rather than a reversal of it: it called clustering "the documented, in-scope Phase 1 feature" and said it was solving a narrower problem "without reaching for it here". `useHotelClusters` and `ClusterPin` now do both jobs — supercluster's `getClusters(bbox, zoom)` **is** the viewport query, so a second hand-rolled bounds filter would be redundant and worse than redundant: culling before clustering makes a cluster pill at the screen edge count only its on-screen members, and the pill's whole purpose is to say how many hotels it stands for. See [ADR-0022 in cheapest-go-app](../../../cheapest-go-app/docs/adr/0022-dense-map-markers-are-clustered-never-truncated.md), which measured 102 markers at cluster radius 80 — the same DOM budget the culling was holding.

**One caveat for whoever reads this next.** This ADR records that the culling approach was taken *at the client's specific request*. Nobody has been back to the client about it. If that constraint still stands, this update is the thing to raise.

**Two improvements from the culling work were dropped in the rebase and should be re-applied — they are orthogonal to clustering and still worth having.** Both are in commit `3db9027`'s version of `src/shared/components/mapbox/SearchMapContainer.tsx`:

- **The dedicated hover effect.** `hoveredId` sat in the create/remove effect's dependency array, so any hover re-ran a full loop over every marker; `3db9027` split it into its own effect touching only the previously- and newly-hovered marker via `prevHoveredIdRef` / `propertyByIdRef`. Clustering does not fix this — the post-rebase code still lists `hoveredId` in the main effect's deps.
- **Staggered marker creation.** `MARKER_STAGGER_THRESHOLD = 30` / `MARKER_STAGGER_CHUNK = 15`, staging creation across `requestAnimationFrame` rather than `requestIdleCallback`, which Safari/iOS does not support. This is not truncation — every marker is still created. Clustering bounds the count to roughly 100, so the threshold still fires and still does useful work.

The `will-change: transform` change this ADR also describes is not in the file and needs no action; had it been, clustering bounds the marker count just as culling did, so it would have stayed safe.
