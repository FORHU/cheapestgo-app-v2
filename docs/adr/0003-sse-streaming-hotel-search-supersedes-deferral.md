# SSE Streaming Hotel Search Supersedes the Blocking-Response Deferral

**Date:** 2026-08-27
**Status:** Accepted

## Context

`CONTEXT.md`'s confirmed Phase 1 scope originally deferred SSE streaming hotel search, noting "single provider, blocking response is fine." Despite that, `feat/hotels-v2` already implements a five-event SSE protocol end to end: the API's `searchStream` controller (`hotels.controller.ts`) emits `instant` → `hotels` → `prices` → `remove` → `done`/`error` chunks over `text/event-stream`, and the frontend (`search/page.tsx`) parses and merges them incrementally, including per-card `priceLoading` UI states. One event type — `prices` — was never wired up on the backend, which is why hotel map markers get stuck at a `$0` placeholder price (see debug session, 2026-08-27).

## Decision

Keep the streaming architecture and fix the missing piece rather than reverting to a single blocking response. The deferral note is stale, not the implementation — the protocol is too deliberately shaped (matching frontend merge-by-id logic and card loading states) to be accidental scope creep.

The `prices` event itself is dropped rather than implemented. `getInstantHotelCatalog` (DB-backed, up to 300 hotels/city) and the live TGX `hotels` chunk (only hotels TGX actually has a rate for, for those exact dates) are different sets by nature — plenty of catalog hotels will have no live TGX rate for a given search, and that's expected, not a bug to enrich away. Resolving real prices for the catalog-only remainder would mean an extra per-hotel `runTgxSearch({ hotelCode })` call for each one — dozens to hundreds of extra TGX calls per search, which the **TGX Scheduling Constraint** (`CONTEXT.md`) doesn't forbid outright (it's still user-initiated) but which the current architecture has no budget for. Instead, any instant-catalog hotel id that isn't confirmed by the `hotels` chunk gets dropped via the already-defined `remove` event. A hotel with no live rate gets no pin, rather than a permanent `$0` placeholder.

## Consequences

- `searchStream` must emit `{ type: 'remove', ids: [...] }` for the set-difference between instant-catalog ids and confirmed `hotels`-chunk ids, once the TGX chunk resolves.
- The `prices` event type stays unused; `priceLoading` placeholders are resolved by either being overwritten (id match in the `hotels` chunk) or removed (no match) — never left stuck.
- `CONTEXT.md`'s Deferred list no longer mentions SSE streaming hotel search; it now appears under confirmed In-scope items, pointing here.
- Reverting to blocking search later would mean discarding the existing chunk-merge frontend logic and card loading states — a real, if not enormous, cost.
