# CheapestGo Domain Glossary

## cheapest-go-app (V1)
The original monolithic Next.js frontend. Source of truth for **feature behaviour**, not for design. Uses Tailwind v4, next-intl (en/ko/ja/zh), Lucia auth, and a rich landing page. V2 reproduces what V1 *does*; it does not reproduce how V1 looks.
_Avoid_: "pixel-perfect clone", "visual clone" — V2 owns its own design (see **Design Independence**).

## cheapestgo-app-v2 (V2)
The refactored frontend using a feature-based folder structure (`src/features/`, `src/shared/`). Owns its own design, and is being brought to **Functional Parity** with V1 through the Feature Port. Connects to `cheapestgo-api-v2` (separate backend).

## Design Independence
V2 has its own design and keeps it. The **Feature Port** carries capabilities across — search, quote, prebook, book, cancel, refund, amend, policies — and leaves V1's layout, components, and styling behind. V1's landing sections, RoomCard, checkout components and legal pages are read as *specifications of behaviour*, never copied as markup.
_Avoid_: "UI Migration" — the port is not a UI migration. _Avoid_: judging a slice by whether it resembles V1 on screen; judge it by whether it does the same thing.

## Locale Segment
Every visitor-facing page lives under `app/[locale]`, so the language is part of the URL: `/ko/property/123`. English is unprefixed. The locale is never read from a cookie — a cookie that outranked the prefix would make a link someone shares render in the recipient's language rather than the sender's. `/admin` sits outside the segment: it is staff-facing and English-only.
_Avoid_: `next/link` and `next/navigation` for `Link`, `useRouter`, `usePathname` or `redirect` — those come from `@/i18n/navigation` and carry the prefix. `useSearchParams`, `useParams` and `notFound` are not locale-aware and stay on `next/navigation`.

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
