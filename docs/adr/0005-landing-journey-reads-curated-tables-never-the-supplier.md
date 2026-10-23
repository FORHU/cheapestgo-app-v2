# ADR 0005 — The Landing Journey Reads Curated Tables, Never the Supplier

**Date:** 2026-10-22
**Status:** Accepted

## Context

The landing page's opening experience is now the **Journey** (see `CONTEXT.md`): a scroll-driven
first-person journey through four destinations — Seoul, Tokyo, Bali, Boracay. Each **Act** shows
one real, bookable hotel, the **Act Stay**, with a name, an image and a price.

The obvious way to fill those cards is `POST /hotels/search`, which is what every other price
surface in the storefront uses. It returns exactly the shape the card wants.

Two things make that the wrong call here, and neither is visible from the component:

1. **The page revalidates on a timer.** `app/[locale]/page.tsx` carries `export const revalidate =
   300`. A search issued during render therefore runs every five minutes, for every locale, for as
   long as the page exists — whether or not a single visitor arrived. Four acts makes that four
   supplier searches per revalidation.

2. **OTV has stated that pre-warming is against the contract.** A scheduled, visitor-independent
   search against the supplier is pre-warming by any reading. The constraint is contractual and was
   given verbally; it appears in no supplier document in this repo, which is precisely why it is
   written here.

Measured for context: a Seoul search on dev took **12.5 seconds**, almost all of it the TGX
dest-code round trip (`[tgx-search][TIMING] dest-code round-trip took 12525ms`). Putting that on a
landing page's render path would be a poor idea even if the contract allowed it.

## Decision

The Journey reads **only** curated tables already in our own database, through a dedicated endpoint:

```
GET /api/v2/hotels/featured?city=<name>&cc=<iso2>
```

`hotel_deals` is the primary source and `hotel_content` the enrichment:

- **`hotel_deals`** carries what the card actually advertises — `name`, `price`, `currency`,
  `image_url`, `stars`, `rating`, `badge`. It is maintained through `/admin/deals`, so the figure on
  the landing page is one a person chose to promote rather than a scrape that happened to be fresh.
- **`hotel_content`**, joined on `hotel_code → hotel_id`, fills what a deal row may lack: street
  address, coordinates, additional images.

`hotel_content` alone cannot serve this card: **it has no price column**, so an Act Stay sourced
from it could never quote a rate however complete the catalog became. That is the reason for the
split, and it is not obvious from either schema.

Both are indexed table reads. Neither makes a supplier call nor touches TGX credentials, and both
answer in milliseconds, so the page may call this during render; `revalidate = 300` costs nothing
meaningful.

The landing page — server side or client side — must not call `/hotels/search`, `/hotels/prebook`,
or any other route that reaches a supplier.

## Alternatives Considered

1. **`/hotels/search` per act, cached.** Rejected: a cache still has to be filled on a schedule, and
   filling it without a visitor is the pre-warming the contract forbids. Caching changes how often,
   not whether.
2. **Search on the client when an act scrolls into view.** A real visitor scrolling is arguably not
   pre-warming. Rejected on experience and load: 12s per act, four per visitor, and the card sits
   empty for most of the scroll. It multiplies supplier traffic by the audience rather than
   bounding it.
3. **Hardcoded stays.** Rejected by the product decision that the cards show real inventory. It also
   decays silently — a card keeps quoting a price after the hotel stops existing.
4. **`/hotels/trending`.** Already exists, already cheap, already contract-safe — but it answers at
   *city* level (city, country, image) with no stay name and no price, so the card loses the two
   things that make it persuasive. Kept as the source for destination imagery, not for the Act Stay.

## Consequences

- A new endpoint exists whose entire purpose is "cheap enough for a landing page". It must stay
  that way: no joins onto live pricing, no supplier enrichment, no fallback to search.
- **The cards render empty until someone fills `hotel_deals` for these four destinations.** At the
  time of writing every source is empty: `/hotels/deals` returns `{"deals":[]}`, `/hotels/trending`
  returns `[]`, and `count?city=Seoul` returns `0`. The remedy is four rows entered through
  `/admin/deals` — minutes of work, and crucially *not* blocked on the ETG dump stalled at roughly
  701k of 1,238,355 records. Choosing `hotel_deals` as primary is what takes the landing page off
  that critical path.
- The price is a promoted figure with a `check_in`/`check_out` on its row, not a live quote for the
  visitor's dates. The card links into a real search; what it displays is indicative and must never
  be presented as bookable. If `last_refreshed_at` goes stale the card advertises an old price —
  worth a staleness guard before this is pointed at production traffic.
- An act whose destination has no deal row renders no card. The Journey still runs; that act simply
  passes without one, which is why the journey must not depend on a card being present.
- If the Journey is ever wanted on a non-revalidating page, this constraint can be revisited — the
  reasoning above is specific to rendering on a timer.
