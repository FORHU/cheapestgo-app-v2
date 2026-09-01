# Room Detail Modal — Design

**Date:** 2026-09-01
**Status:** Draft for review
**Branch:** `feat/hotels-v2`
**Repos:** `cheapestgo-app-v2` (frontend), `cheapestgo-api-v2` (backend)

## Problem

The property page's room cards open a compact "View more" modal (`RoomDetailDialog`
in `src/features/hotels/components/room-selection.tsx`). Today it shows a flat,
uncategorised list built from two weak sources:

- structural rows parsed from the room name (bed, occupancy, size)
- the **hotel's** amenity list, filtered by a keyword regex (`IN_ROOM_AMENITY`),
  used only when the rate carried none of its own — which, for TGX/OTV, is always.

The result mixes property-level facts ("Television in lobby", "Reception desk")
with room-level ones ("Slippers", "Kettle") under a single "ROOM" heading, with
no way to tell which is which.

The Figma redesign calls for a Booking.com-style room modal: a **key-facts block**,
then **one header per amenity category** ("Room layout and furnishings",
"Toiletries", "Bathroom", "Media and technology", …) with the relevant items
beneath each. Anything we cannot categorise goes in a free-text
"Additional information" block.

## What's available from the providers

### TGX / OTV (the booking supplier) — almost nothing at room level

Per **ADR-0019** (`cheapest-go-app/docs/adr/0019-…`), OTV returns `roomData: null`
for the dedicated room-content query; introspecting `HotelXRoomQueryInput`
confirmed there is no setting we failed to send. A TGX room in a search option is
just `{ code, description, occupancyRefId }`, plus the rate's board / price /
cancellation policy / refundable flag / quoted occupancy. This is why room
**photos** already come from ETG.

**Usable from TGX:** room name/description (bed type is sometimes embedded as a
parenthetical or a noise string like *"bed type is subject to availability"*),
board, price, cancellation terms, occupancy. Hotel-level: a flat uncategorised
`amenities { code }` list.

### ETG / WorldOTA / RateHawk (`hotel/info` content API) — nearly everything

**Per room-type** — `room_groups[]`:

| Field | Contents |
|---|---|
| `name`, `name_struct` | `main_name`, `bedding_type` ("twin beds", "double bed"), `bathroom` ("private", "shared") |
| `rg_ext` | structured ints: `bedding`, `capacity`, `bedrooms`, `class`, `quality`, `balcony`, `view`, `floor`, `family`, `club`, `sex` |
| `room_amenities[]` | **one flat slug list** — `private-bathroom`, `shower`, `bidet`, `toiletries`, `towels`, `slippers`, `bathrobe`, `hairdryer`, `tv`, `cable-tv`, `wi-fi`, `telephone`, `air-conditioning`, `heating`, `fan`, `safe`, `desk`, `wardrobe`, `iron`, `minibar`, `fridge`, `kettle`, `coffee`, `microwave`, `kitchen`, `kitchenette`, `balcony`, `city-view`, `non-smoking`, `soundproofing`, … ETG does **not** bucket these. |
| `images[]` | room-group photos |

**Per hotel:**

| Field | Contents |
|---|---|
| `amenity_groups[]` | `{ group_name, amenities[], non_free_amenities[] }` — **categorised**. Group names include "General", "Services and amenities", "Media and technology", "Internet", "Meals", "Kids", "Parking", "Pets", "Pool and beach", "Accessibility", "Safety and security", "Languages spoken", "Transfer", … |
| `metapolicy_struct` | structured policies: `children` (`[{age_start, age_end, extra_bed}]`), `children_meal`, `cot` (`[{amount, price, currency, inclusion}]`), `extra_bed`, `pets`, `deposit`, `no_show`, `parking`, `internet`, `meal`, `shuttle`, `visa` |
| `metapolicy_extra_info` | free-text policy |
| `important_information` / `description_struct` | free text |
| `serp_filters[]` | coarse booleans: `has_internet`, `kitchen`, `air-conditioning`, `has_bathroom`, … |
| `facts` | `{ floors_number, rooms_number, year_built, year_renovated, electricity: {voltage, sockets, frequency} }` |
| `check_in_time`, `check_out_time` | front-desk hours |

### Category-by-category verdict

| Modal section | Source | Scope | Notes |
|---|---|---|---|
| Key facts (bed, size, window, smoking, floor, internet, A/C, bathroom type) | `name_struct` + `rg_ext` + `room_amenities` + `metapolicy.internet` | room | bed falls back to TGX description string |
| Room layout and furnishings | `room_amenities` (classifier) | room | |
| Toiletries | `room_amenities` (classifier) | room | derived — ETG has no toiletries group |
| Food and drink | `room_amenities` (classifier) | room | minibar, coffee, kettle, water |
| Bathroom | `room_amenities` + `name_struct.bathroom` | room | derived |
| Internet and communications | `room_amenities` (wi-fi, telephone) + `metapolicy.internet` | room | |
| Room amenities | `room_amenities` (catch-all) | room | climate, bedding, soundproofing, iron |
| Media and technology | `room_amenities` + `amenity_groups` "Media and technology" | room + hotel | |
| Kitchen facilities | `room_amenities` (classifier) + `serp_filters` "kitchen" | room | |
| General amenities | `room_amenities` leftovers (safe, alarm-clock) | room | |
| Child policies | `metapolicy.children`, `children_meal` | hotel | |
| Cribs & extra beds | `metapolicy.cot`, `metapolicy.extra_bed` | hotel | rendered as a summary sentence + optional priced rows |
| Additional information | `important_information` + `metapolicy_extra_info` + `metapolicy` (`pets`/`deposit`/`parking`) + `description_struct` tail | hotel | catch-all free text |

**Two structural caveats:**

1. **We own the bucketing.** ETG's `room_amenities` is a single flat slug list per
   room-group; the section split is a `slug → { label, section, icon }` classifier
   that we maintain. V1's `ETG_ROOM_AMENITY_MAP`
   (`cheapest-go-app/src/lib/server/stays/travelgatex/amenityCodes.ts`) is the seed.
2. **Room matching is fuzzy.** Nothing links a TGX room code to an ETG room-group,
   so it's name-matching with the same failure modes as room photos (ADR-0019's
   `matchEtgRoomGroup`). Hotel-scoped sections (child policies, cribs/extra beds)
   sidestep this.

### What V2 has today (the gap)

- `hotel_content` has **empty** `amenity_groups`, `room_groups`,
  `important_information` columns — the schema exists, but nothing writes them;
  `search.ts` only ever extracts a flat `amenities[]` from ETG's response.
- No `metapolicy_struct` / `serp_filters` columns at all.
- No ETG dump-sync cron, no `seedHotelRoomGroupsById`, no `hotel/info` call in
  `getProperty` — the property endpoint returns TGX rooms + flat content only.
- ETG credentials and a cron pattern already exist (`etg-reviews-sync`), so the
  plumbing is familiar.

So every "available" cell above is *"fetchable, once we build the fetch."*

## Decisions (settled with the requester)

1. **Pipeline: on-demand + cache.** `getProperty` calls ETG `hotel/info` when the
   hotel's content is stale/missing, parses `room_groups` + `amenity_groups` +
   `metapolicy_struct` into `hotel_content`, and serves from the DB thereafter.
   New nullable columns. No cron. (Matches how room photos work in V1.)
2. **Granularity: matched room sections + property sections.** Port V1's
   `matchEtgRoomGroup`. Room-scoped sections come from the matched room-group;
   property-scoped sections (child policies, cribs/extra beds) come from
   `metapolicy_struct`.
3. **Content: photo gallery + all applicable sections.** The modal's top area is
   the matched room-group's photos (fallback to the hotel photo with a caption);
   below, every section that has data, each under its own header, plus the
   free-text "Additional information" block.
4. **Layout: one header per category** (the second reference image), not a flat
   list. Sections flow in a responsive grid — several across in a wide modal
   (the first Figma), stacked in a narrow one.

## Architecture

Logic lives in the **API**; the modal is a presentational renderer. The
classifier is design-stable ("is a bidet a bathroom fitting" doesn't change when
columns get reordered); the expensive parts (ETG fetch, DB cache, fuzzy matching)
are inherently server-side; and `room-selection.tsx` stays presentational like it
is now, consistent with `groupByRoomName` / `BOARD_LABELS` already living in
`src/lib/hotels/property.ts`.

### Data flow

```
getProperty(hotelId, stay)
 ├─ existing: TGX hotel search → groupByRoomName → RoomOption[]
 ├─ NEW ensureEtgContent(hotelId)                       ← on-demand + cache
 │    ├─ hotel_content.etg_content_seeded_at fresh (< 30d) & has room_groups → use DB
 │    └─ else POST worldota/hotel/info { id: ratehawk_hid }   (8s timeout, best-effort)
 │             parse → room_groups, amenity_groups, metapolicy_struct,
 │                     important_information, serp_filters, facts
 │             UPSERT hotel_content (+ new cols), stamp etg_content_seeded_at
 ├─ NEW per RoomOption:
 │        match  = matchEtgRoomGroup(room.name, room_groups)       ← ported from V1
 │        room.content = buildRoomContent(match, amenityGroups)
 └─ NEW content.roomPolicySections = buildPolicySections(metapolicy_struct)
    content.additionalInfo       = buildAdditionalInfo(important_information,
                                       metapolicy_struct, metapolicy_extra_info)
```

`ensureEtgContent` runs **inside** `getProperty`'s existing `Promise.all`, wrapped
in a timeout so a slow/failed ETG call never delays the page past the TGX search.
On a cold cache the first visitor may get the legacy modal; the content is
populated for the next visitor. (V1 awaits this on-demand within
`fetchTgxRoomCatalog`; matching that exactly is acceptable — see Open Questions.)

No cron, and no TGX scheduling-constraint issue: ETG's content API is read-only
and this call is user-initiated (a real property-page view).

### Schema — additive migration on `hotel_content`

```prisma
model hotel_content {
  // ...existing
  metapolicy_struct     Json?
  serp_filters          String[]  @default([])
  etg_content_seeded_at DateTime? @db.Timestamptz(6)
  // amenity_groups, room_groups, important_information already exist — start writing them
}
```

All nullable / defaulted; no backfill required; existing rows keep working.

### API response additions — all optional, backwards-compatible

```ts
interface RoomOption {
  // ...existing
  content?: RoomContent;
}

interface RoomContent {
  gallery: string[];            // matched room-group images; [] when no confident match
  matchedRoomName?: string;     // for the "photos of a similar room" caption / debugging
  keyFacts: DetailItem[];       // headerless top block
  bedLine?: string;             // "2 double beds" | TGX noise string, verbatim
  bedsExtraSummary?: string;    // "Extra beds and cribs are unavailable for this room type"
  sections: DetailSection[];    // room-scoped, non-empty only, in canonical order
}

interface PropertyApiResponse {
  // ...existing
  content?: HotelContent & {
    roomPolicySections?: DetailSection[];  // child-policy, cribs/extra-beds (priced rows)
    amenityGroups?: AmenityGroup[];        // grouped hotel amenities — also feeds PropertyDescription
    additionalInfo?: string;               // free-text tail for the modal
  };
}

interface DetailSection {
  id: 'room-layout' | 'toiletries' | 'food-drink' | 'bathroom'
    | 'internet-comms' | 'room-amenities' | 'media-tech' | 'kitchen'
    | 'general' | 'child-policy' | 'beds-extra';
  title: string;                // "Room layout and furnishings"
  scope: 'room' | 'property';
  items: DetailItem[];          // never rendered when empty
}

interface DetailItem {
  label: string;               // "Blackout curtains"
  icon?: string;               // string key → lucide in the FE
  note?: string;               // "EUR 20 per night", "on request", "contact hotel"
}

interface AmenityGroup { groupName: string; amenities: string[]; nonFree: string[] }
```

### Backend modules (new / changed in `cheapestgo-api-v2`)

| File | Change |
|---|---|
| `prisma/schema.prisma` + migration | 3 new nullable columns (above) |
| `src/lib/hotels/etgContent.ts` *(new)* | `ensureEtgContent(hotelId)`, `parseRoomGroups`, `parseAmenityGroups`, `parseMetapolicy` — ported/adapted from V1 `etg/roomGroups.ts` + `etg-dump-sync.mjs` parse helpers |
| `src/lib/hotels/roomMatch.ts` *(new)* | `matchEtgRoomGroup(description, groups)` — ported verbatim from V1 `travelgatex/search.ts` (Pass 0 bedding-type → exact → prefix → bed-keyword; **no tier-word fallback**) |
| `src/lib/hotels/roomContent.ts` *(new)* | `AMENITY_SECTION_MAP` (`slug → { label, section, icon }`), `buildRoomContent`, `buildPolicySections`, `buildAdditionalInfo`, `buildKeyFacts` |
| `src/lib/hotels/amenityCodes.ts` | extend `ETG_ROOM_AMENITY_MAP` entries with `section` + `icon`; keep `etgRoomAmenityToLabel` |
| `src/services/hotels.service.ts` | `getProperty` calls `ensureEtgContent` in the `Promise.all`, then decorates each room + the content object |
| `src/lib/hotels/property.ts` | `RoomOption` / response types gain the optional fields above |

### Classifier — `slug → section`

First-match wins, evaluated top-to-bottom; unmatched mapped slugs fall to
`room-amenities`; unmapped slugs are prettified and also fall to `room-amenities`.

| Section | Slug patterns |
|---|---|
| `bathroom` | private-bathroom, shared-bathroom, shower, bath, bathtub, bidet, jacuzzi, hot-tub, toilet, toilet-paper |
| `toiletries` | toiletries, free-toiletries, shampoo, soap, conditioner, body-wash, towels, slippers, bathrobe, hair(-)?dryer, dental-kit, shower-cap |
| `food-drink` | minibar, coffee, coffee-machine, tea-or-coffee, kettle, electric-kettle, bottled-water, water-cooler, breakfast-in-room, fruits, wine |
| `kitchen` | kitchen, kitchenette, fridge, refrigerator, microwave, dishwasher, toaster, oven, stove, stovetop, cookware, kitchenware, dining-table |
| `internet-comms` | wi-?fi, wired-internet, internet, telephone |
| `media-tech` | tv, television, cable-tv, satellite-tv, flat-screen-tv, streaming, netflix, dvd-player, radio, ipod, bluetooth-speaker |
| `room-layout` | wardrobe, closet, desk, sofa, sofa-bed, seating-area, dining-area, clothes-rack, drying-rack, blackout-curtains, curtains, soundproofing, connecting-rooms, interconnecting, private-entrance, balcony, terrace, patio, .*-view, view |
| `general` | safe, in-room-safe, alarm-clock, wake-up, hypoallergenic, cleaning-products, socket-near-bed, extension-cord |
| `room-amenities` | **catch-all** — air-conditioning, heating, fan, fireplace, iron, ironing-board, carpeted, hardwood-floor, bedding, blanket, quilt, pillow, mosquito-net, non-smoking, smoking, pet-friendly, + anything unmatched |

`keyFacts` is assembled separately (not via the classifier), from:
`bedLine` · `size` (`rg_ext` / `name` regex) · window (`has-window` slug or `rg_ext`)
· smoking (`non-smoking`/`smoking` slug) · floor (`rg_ext.floor`) ·
`Internet: {free|paid|contact hotel}` (`metapolicy.internet`) · `Air conditioning`
(slug present) · bathroom type (`name_struct.bathroom` / `private-bathroom` slug).

`buildPolicySections`:
- `child-policy` ← `metapolicy.children` → "Children 0–5 stay free",
  "Children 6–11: extra bed EUR 20"; `+ children_meal`.
- `beds-extra` ← `metapolicy.cot` / `.extra_bed`. When both are empty/"not available"
  → `bedsExtraSummary = "Extra beds and cribs are unavailable for this room type"`
  and **no** section. When priced → a `beds-extra` section with `note`s
  ("Cot — on request, free", "Extra bed — EUR 25 per night").

`buildAdditionalInfo` concatenates, as sentences: `important_information`,
`metapolicy_extra_info`, and phrased `metapolicy` (`pets`, `deposit`, `parking`,
`no_show`), then the `description_struct` tail not already shown on the page.

## Frontend (`cheapestgo-app-v2`)

### `RoomDetailDialog` redesign — `src/features/hotels/components/room-selection.tsx`

- Widen `max-w-lg` → `max-w-4xl`; keep the centred portal, backdrop, `Esc` handler,
  `max-h-[90vh]` scroll.
- **Header:** room name + a hairline rule (Figma), board + refundable pills (keep).
- **Bed line + availability sentence:** `content.bedLine` with a `Bed` icon, then
  `content.bedsExtraSummary` in muted text.
- **Gallery:** `content.gallery` as a horizontal thumbnail strip → click opens a
  lightbox. Extract the `Lightbox` currently inline in
  `src/app/[locale]/property/[id]/page.tsx` to
  `src/features/hotels/components/lightbox.tsx` and share it. No confident match →
  single hotel photo + a muted "Photo of the property" caption; no hotel photo →
  gallery omitted.
- **Key facts:** headerless 2-column grid of `content.keyFacts`.
- **Categorised sections:** `content.sections` then
  `pageContent.roomPolicySections`, in a responsive grid
  (`repeat(auto-fill, minmax(220px, 1fr))`), each a header + item grid. Reuses the
  dot/heading visual language of the current `DetailColumn`. No "At this property"
  divider — property sections just come last.
- **Meal plan** and **Cancellation policy** blocks (rate-scoped) — keep, positioned
  after the sections, before Price.
- **Price + Select Room** footer — keep.
- **Additional information:** collapsible block at the bottom, reusing the
  `Disclosure` pattern from `property-description.tsx`, fed by
  `content.additionalInfo`.
- `DetailItem.icon` (string key) → lucide via a small `SECTION_ICONS` map;
  unknown → reuse `featureIcon()`.

### `PropertyDescription` upgrade (side benefit) — `property-description.tsx`

When `content.amenityGroups` is present, render the amenity chips grouped by
`groupName` instead of the current flat split via `splitAmenities`. Falls back to
the flat `amenities[]` list when `amenityGroups` is absent. Keeps the existing
"Rules & Policies" behaviour.

### Types — `src/features/hotels/types/property.types.ts`

Mirror the API additions: `RoomContent`, `DetailSection`, `DetailItem`,
`AmenityGroup`, and the optional fields on `RoomOption` / `HotelContent`.

### Fallbacks & empty states

- A section with 0 items → not rendered (today's `DetailColumn` rule).
- `room.content` undefined (no `ratehawk_hid`, ETG failed/timed out, no room-group
  match) → the modal renders **exactly today's compact content** (structural rows
  + `hotelAmenities` filtered by `IN_ROOM_AMENITY`). The redesign is strictly
  additive; the old path is the fallback.
- ETG failure is **silent** — nothing in the UI or the booking path reports it
  (consistent with ADR-0019).

## Testing

**Backend (`cheapestgo-api-v2`, vitest):**

- `roomMatch.test.ts` — port V1's `roomGroups.test.ts` cases: bedding-type Pass 0
  distinguishes twin vs double; exact beats prefix; no tier-word cross-match;
  unmatched → empty.
- `roomContent.test.ts` — `buildRoomContent`: slug list in → sections out; `[]` in
  → `[]`; unknown slug → `room-amenities`; `keyFacts` assembled from
  `name_struct` + `rg_ext` + `metapolicy.internet`.
- `policySections.test.ts` — `metapolicy` fixtures: `children` → `child-policy`
  rows; `cot` + `extra_bed` priced → `beds-extra` section with `note`s; both empty
  → `bedsExtraSummary`, no section.
- `etgContent.test.ts` — `ensureEtgContent`: fresh DB row → no fetch; stale → fetch
  + upsert; `hotel/info` 4xx/timeout → returns cleanly, `content` undefined.

**Frontend (`cheapestgo-app-v2`, vitest + testing-library):**

Extend `src/features/hotels/__tests__/room-selection.test.tsx`:

- modal renders a header + items per `content.sections` entry;
- empty sections are omitted;
- `content` undefined → legacy structural rows + amenity list still render;
- key-facts block renders `content.keyFacts` with no header;
- `bedsExtraSummary` renders when present;
- gallery falls back to the hotel photo with its caption when `gallery` is `[]`.

## Scope & risk

- **Phase 1.** The property page is in scope; ETG's read-only content API is
  explicitly allowed (CONTEXT.md). Migration is additive. No cron. No TGX
  scheduling-constraint concern.
- **Room-match fidelity.** Inherits ADR-0019's fuzzy-match risk. Mitigation: the
  matcher has no tier-word fallback, so an unmatched room shows the hotel photo
  and the legacy compact body rather than another room's fittings.
- **ETG dependency.** Losing ETG credentials degrades every room modal to the
  legacy body while leaving booking (TGX) intact and unreported — same
  trade-off already accepted for room photos.
- **Cold-cache first view.** First visitor to an unseeded hotel gets the legacy
  modal. Acceptable, and consistent with how amenity enrichment already works in
  `search.ts`.

## Open questions for review

1. `ensureEtgContent` — **await with an 8s timeout** in `getProperty` (first
   visitor may block ~1–2s on a cold cache, but gets full content), or
   **fire-and-forget + serve stale** (first visitor never blocks, but gets the
   legacy modal)? Spec currently assumes await-with-timeout.
2. Responsive section grid: is a single wide modal with a `minmax(220px,1fr)`
   auto-grid the right call for both the wide Figma and the narrow reference, or
   should the modal have a fixed narrow width and always stack?
3. `PropertyDescription` grouped-amenities upgrade — in scope for this work, or
   split into a follow-up?
