# CheapestGo Domain Glossary

## cheapest-go-app (V1)
The original monolithic Next.js frontend. Source of truth for **feature behaviour**, not for design. Uses Tailwind v4, next-intl (en/ko/ja/zh), Lucia auth, and a rich landing page. V2 reproduces what V1 *does*; it does not reproduce how V1 looks.
_Avoid_: "pixel-perfect clone", "visual clone" — V2 owns its own design (see **Design Independence**).

## cheapestgo-app-v2 (V2)
The refactored frontend using a feature-based folder structure (`src/features/`, `src/shared/`). Owns its own design, and is being brought to **Functional Parity** with V1 through the Feature Port. Connects to `cheapestgo-api-v2` (separate backend).

## Design Independence
V2 has its own design and keeps it. The **Feature Port** carries capabilities across — search, quote, prebook, book, cancel, refund, amend, policies — and leaves V1's layout, components, and styling behind. V1's landing sections, RoomCard, checkout components and legal pages are read as *specifications of behaviour*, never copied as markup.
_Avoid_: "UI Migration" — the port is not a UI migration. _Avoid_: judging a slice by whether it resembles V1 on screen; judge it by whether it does the same thing.

## Journey
The landing page's opening sequence: a scroll-driven descent through everything CheapestGo sells —
stays, flights, AI planning — ending where the visitor chooses. It stands where the looping backdrop
video used to. The visitor is not shown the product one slide at a time; they assemble a trip while
descending, and arrive holding it.
_Avoid_: "hero video" — a hero repeats on its own; the Journey only moves when scrolled.
_Avoid_: "carousel" — nothing cycles, and nothing returns.

## Stage
One step of the **Journey**, owning a span of **Journey Progress**: Stays, Flights, AI, then Options.
Each stage puts one real product surface in front of the visitor and writes one **Pass Line**. A
stage is a place in the descent, not a section of a document.
_Avoid_: "slide" — a slide is crossed in one step and carries nothing forward.

## Journey Progress
How far the visitor has scrolled through the **Journey**, as 0 → 1 across a scroll track several
viewport-heights tall. Every moving part reads this one number: which **Showcase** is lit, which
search is docked, which **Pass Line** has been written.
_Avoid_: deriving it per component — one value is computed and passed down, or the layers drift
apart by a frame and visibly disagree mid-scroll.

## Boarding Pass
The artefact the **Journey** builds. It docks on screen and fills as the visitor descends, one
**Pass Line** per **Stage**, and at the end its button runs exactly the search it describes. It is
what stops the scroll being decorative: the visitor leaves with a trip rather than an impression
of one.
_Avoid_: treating it as a graphic — every line on it is real search state, and the final button
must run that state rather than a generic search.

## Pass Line
One row a **Stage** writes onto the **Boarding Pass** — a destination and nights, a route, a
suggestion the AI made. Pre-filled so the pass is alive for someone who only scrolls, and replaced
the moment the visitor types their own value.
_Avoid_: showing a line whose stage has not been reached; the pass fills in step with the descent.

## Showcase
What a **Stage** puts behind its search surface — destination photography for Stays, flight motion
for Flights. It exists to make the product legible, not to be looked at: it sits behind the thing
the visitor came to use.
_Avoid_: procedural geometry — the reference design's own primitives are what "not cartoonized"
rules out.

## Locale Segment
Every visitor-facing page lives under `app/[locale]`, so the language is part of the URL: `/ko/property/123`. English is unprefixed. The locale is never read from a cookie — a cookie that outranked the prefix would make a link someone shares render in the recipient's language rather than the sender's. `/admin` sits outside the segment: it is staff-facing and English-only.
_Avoid_: `next/link` and `next/navigation` for `Link`, `useRouter`, `usePathname` or `redirect` — those come from `@/i18n/navigation` and carry the prefix. `useSearchParams`, `useParams` and `notFound` are not locale-aware and stay on `next/navigation`.

## Stay Total
What the supplier quotes: the price of the **whole stay**, however many nights that is. The only
figure a supplier states and the only one a booking is made against.
_Avoid_: printing it beside "/ night" — a three-night stay then advertises at three times its
rate, which is what happened on the search card and the deals row on 2026-09-25.

## Nightly Rate
The **Stay Total** divided by the nights in the stay — what every price surface in the storefront
shows, because that is how travellers compare places to sleep. Divided **server-side**, so no
screen can forget and none can do it twice.
_Avoid_: dividing again in a component; the wire already carries this. _Avoid_: sending it to
checkout as though it were the stay — a summary prices a stay, so it is multiplied back up there.

## Display Currency
What a price is *shown* in across the storefront — the one the viewer picked, and the one every
screen from search to the payment button must agree on. The picker offers only currencies that
can actually be charged, so the currency on screen is always one Stripe can bill.
_Avoid_: computing a price from it in the browser — api-v2 converts its own recorded quote, and
two independent conversions drift apart into a price-changed prompt. What the browser converts
is a placeholder to fill the gap before the server answers, never a figure anyone pays.

## Supplier Currency
What the provider (OTV/TGX, Duffel) quoted. Authoritative for the *price* and the basis api-v2
charges from — and invisible to the customer, who never chose it.
_Avoid_: carrying it into checkout as though it were the **Charge Currency**. A room advertised
at ₩69,680 a night opened a checkout quoting PHP on 2026-09-25, because the link to it named the
supplier's currency: the same money, with nothing on screen to say why it had changed.

## Charge Currency
What Stripe bills, which is the customer's **Display Currency**. One booking has exactly one,
and a refund is issued in it so the customer sees no FX drift.
_Avoid_: reading it off the rate table — holding a rate for a currency does not make it
chargeable.

## Functional Parity
The bar the Feature Port is held to: every capability V1 has, V2 has, behaving the same way. It is parity of behaviour and API surface, not of appearance. V2-unique AI features (ChatWonder, Voice Layer) remain Phase 2 and are outside it.
_Avoid_: treating parity as finished because the endpoint exists — it is parity of behaviour, and an endpoint that is a version behind is not at parity.

## ChatWonder AI
Third-party AI chat engine provided by **forhu.ai**. Powers the conversational interface in Phase 2. Exposes a WebSocket endpoint for real-time streaming (`wss://chat-dev.forhu.ai/chat-stream`) and a REST API (`https://chat-dev.forhu.ai`). The frontend connects directly via WebSocket; the backend also calls it via REST for server-side orchestration. Not to be confused with an in-house model — CheapestGo does not train or fine-tune this model.

## Generative UI
The hybrid interface pattern described in the product roadmap: AI understands natural-language user intent and responds with structured, interactive UI components (itinerary cards, bookable flight/hotel widgets, maps) rather than plain text. Distinct from a traditional chatbot. The FE is responsible for rendering these components; the AI (ChatWonder) returns structured data that drives the component selection.

## Phase 1 — Lowest-Fare Engine
The current build target: a global flight and hotel search/booking platform competitive with Skyscanner. Establishes the user base and collects behavioral data for Phase 2 AI training. Revenue via booking commissions.

## Phase 2 — AI Travel Agent
Integration of ChatWonder AI into the travel booking flow. Features: natural language search, long-term user memory (travel preferences, loyalty status, calendar), proactive suggestions, Generative UI output, and voice input/output (AWS voice services). Revenue via ancillary sales (insurance, tours) and subscriptions.

## Phase 3 — AI Commerce Super-Platform
Expansion from travel into e-commerce using travel intent as a purchase signal. Agentic commerce where the AI proactively suggests products relevant to an upcoming trip. Uses MCP, Universal Commerce Protocol, and Agent Payment Protocol for cross-platform agent interoperability.

## Chat Session Context
The set of user parameters collected before a ChatWonder chat session begins. Passed as initial context to ChatWonder to personalize the conversation. Fields: **travel date(s)**, **destination/location**, **traveler gender**, **traveler age**, **party size** (number of people). This is not fetched from the BE at runtime — it is collected from the user via an intake form on the FE before the WebSocket connection opens.

## V2 Phase 1 Scope (confirmed)

### In scope — must ship before V2 launch
- All admin panels fully implemented (Duffel dashboard, TGX admin, Stripe admin, communication, user promote/ban). V1 `/api/internal/auto-recover` and `/api/fn/` function runner folded into admin panel actions — no generic function runner in V2.
- Mapbox map on search page (clustering, markers, click-to-filter) and property page sidebar
- SSE streaming hotel search (progressive results + per-hotel price resolution) — see ADR-0003, supersedes the earlier blocking-response deferral
- POI discovery on property page (Google Places)
- ETG hotel reviews on property page
- PWA: service worker + install prompt
- Voucher system: validate, list, and record-on-booking endpoints
- User preferences: GET/PUT cabin class, seat, meal preference
- Booking amend: local DB update for contact details + special requests (no TGX call)
- All safe cron jobs (see Cron Jobs section)
- Error monitoring: CloudWatch Logs on EC2 via winston-cloudwatch; Vercel Analytics on frontend
- Flight post-booking: cancel (unified Duffel+Mystifly), void/reissue/refund as Mystifly-only stubs returning 503 until live key
- Image handling: hotel + destination images via Next.js `<Image>` with `remotePatterns` (no proxy); only Google Places photos proxied through V2 API to protect API key

### Deferred — not in Phase 1
- PDF invoice generation (print-friendly HTML page is acceptable fallback)
- Weather widget on property page
- Push notifications / Expo device token registration
- AI search bar (ChatWonder, Voice Layer) — Phase 2
- Hotel price alerts — TGX constraint blocks automated polling
- Sentry — replaced by CloudWatch + Vercel Analytics
- Mobile `/register-device` endpoint — push notifications deferred

## Infrastructure (Production)
- **Database:** AWS RDS (PostgreSQL)
- **API server:** AWS EC2 (Express.js V2 API)
- **Frontend:** Vercel (Next.js V2 App)
- **Logging:** CloudWatch Logs via winston-cloudwatch on EC2

## Voice Layer
AWS services (region: ap-southeast-1) used for voice input and output in the chat interface. Likely Amazon Transcribe (speech-to-text) and Amazon Polly (text-to-speech). Distinct from ChatWonder AI, which handles text reasoning.

## Price Alert
A user-saved route + cabin class combination for which CheapestGo monitors flight fares and emails the user when the price drops below their last-seen price or a target they set. **Scope: flights only.** Hotel price alerts are not supported — TGX prohibits automated/scheduled search calls (searches must be user-initiated with real intent), so periodic hotel price polling is contractually illegal.

## TGX Scheduling Constraint
TravelgateX (OTV/WorldOTA) prohibits automated, scheduled, or background API calls that are not triggered by real user intent. This means: no cron-based hotel search, no hotel cache warming, no hotel deal syncing via TGX. All TGX calls must originate from a live user action. Any cron job that would require calling the TGX search API is out of scope for V2. User-initiated calls (search, quote, book, cancel) are fully permitted.

## Cron Jobs (V2 Scope)
Jobs that are safe and in-scope for V2 API (all DB-only or non-TGX providers):
- `check-price-alerts` — flights only (Duffel/Mystifly)
- `cleanup-sessions` — DB housekeeping
- `cache-cleanup` — DB housekeeping
- `duffel-balance-check` — Duffel API
- `poll-pending-tickets` — Duffel/Mystifly
- `sync-flight-deals` — Duffel
- `refresh-popular-flights` — Duffel
- `cleanup-orphaned-duffel-orders` — Duffel
- `etg-reviews-sync` — ETG/WorldOTA content API (read-only hotel data, not booking/search)
- `otv-credit-check` — DB-only (counts TGX bookings in local DB; no TGX API call)

Jobs that are **out of scope** due to TGX constraint:
- `sync-hotel-deals` (V2 stub) — would require TGX polling; drop it
- `warm-hotel-cache` (V1 fn) — TGX polling; do not port to V2
