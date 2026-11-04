# Golf catalogue — design

**Date:** 2026-11-04
**Repos:** `cheapestgo-api-v2` (domain, ADR-0017) and `cheapestgo-app-v2` (UI)
**Branch:** `feat/golf-catalogue` in both, cut from the current `feat/flight-booking-money-safety` tips (see *Decisions*)
**Level with v1:** `0cb892d6` on `cheapest-go-app` branch `feat/golf-courses` (golf is not on v1 `main` or `staging`)
**Status:** approved in conversation; first golf slice

## 1. Goal

Customers can browse the golf courses CheapestGo arranges play at, open a course, and ask about tee
times in the support chat. Admins curate the courses by hand. There is no golf supplier, and nothing
is booked or paid for in this slice.

This is the first of five golf slices ported from v1. Each gets its own spec, plan and build:

1. **Catalogue** — this document.
2. **Tee-time booking** — schedules, generated tee times, hold → card authorised → course confirms →
   capture, emails, sweep and generation crons, Stripe webhook, admin bookings, customer-currency
   charging (v1 ADR-0051).
3. **Extras, trust and search** — club rental / caddie / cart, the all-in price, course policy and
   fact block, search by date, players and time window.
4. **Course portal** — the `course_staff` role, invitations and self-registration, tee-sheet control,
   closures, photo upload, cancellation by the course (v1 ADR-0052).
5. **Golf in My Bookings.**

## 2. Decisions

- **The port is functional, not visual** (ADR-0016, *Design Independence*). v1's golf pages are read
  as a specification of behaviour. The screens are built in app-v2's own design language: the shared
  `Header`/`Footer`, Plus Jakarta, the flat cards from the 2026-11 border-radius cleanup
  (`da5496e`, `8452efc`), light and dark through the existing tokens.
- **The branch is cut from the flight branch, not `staging`.** The Journey landing (`18712af`), the
  immersive search bar (`6676e64`) and the border-radius cleanup exist only on
  `feat/flight-booking-money-safety`. This slice edits the first two and follows the third, so it
  cannot start from `staging`. It is rebased onto `staging` once the flight branch merges. Same
  precedent as the hotel booking flow spec.
- **v2 has its own golf migration.** v1's migration file is not copied. The table is defined in a
  migration written for v2, in the style of api-v2's other migrations, with its own header saying
  what the table is for. It keeps v1's columns and constraints (§3), because those are the rules
  being ported, but it does not depend on v1's file, version number or a refresh from v1's
  database. v1's version number is deliberately not reused: dbmate keys on version alone, and v1
  and v2 already collide at `20261015000001` (v1 `golf_course_photos`, v2 `hotel_booking_lifecycle`).
  This follows the flight and hotel lifecycle migrations, which v2 also authored.
- **Photos are pasted `https://` URLs**, one ordered list whose first entry is the cover, as v2's
  destinations admin does today. Upload arrives with slice 4, as it did in v1. `image_urls` stays
  the list customers see, so uploads slot in without a schema change.
- **The "from" green fee is shown in the viewer's Display Currency, converted by api-v2.** This is
  v1's current behaviour (`viewerCurrency.ts`) and v2's *Display Currency* rule. It is a guide, never
  a quote. A conversion that cannot be made leaves the course's own figure in its own currency.
- **Entry points are the Journey's Golf card and a Golf tab in the immersive search bar.** No footer
  link, sitemap entry, home-page row or header link in this slice.
- **Admin routes follow v2's REST verbs**, not v1's single `POST { action }`.

## 3. Data

Migration `cheapestgo-api-v2/db/migrations/20261104000001_golf_courses.sql`, dbmate format, written
for v2. `migrate:up` creates the table below with `IF NOT EXISTS`, as api-v2's other migrations do,
so re-applying it by hand is harmless; `migrate:down` drops the table.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `slug` | `text` NOT NULL UNIQUE | URL key; CHECK `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `name` | `text` NOT NULL | |
| `country` | `text` NOT NULL | display name, e.g. "Philippines" |
| `city` | `text` NOT NULL | |
| `address` | `text` NULL | |
| `description` | `text` NOT NULL DEFAULT `''` | plain text, paragraphs split on blank lines |
| `holes` | `integer` NOT NULL | CHECK `holes IN (9, 18, 27, 36)` |
| `par` | `integer` NULL | CHECK `par BETWEEN 27 AND 144` |
| `green_fee_from` | `numeric(10,2)` NULL | indicative "from" price, never a quote; CHECK `>= 0` |
| `currency` | `char(3)` NOT NULL DEFAULT `'USD'` | the course's currency; CHECK `^[A-Z]{3}$` (new in v2) |
| `image_urls` | `text[]` NOT NULL DEFAULT `'{}'` | first is the cover |
| `amenities` | `text[]` NOT NULL DEFAULT `'{}'` | codes from the closed list below |
| `status` | `text` NOT NULL DEFAULT `'draft'` | CHECK `status IN ('draft','published')` |
| `created_at`, `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | `updated_at` set by the repository on update |

Index `idx_golf_courses_status_country` on `(status, country)`.

After `dbmate up` on 5434, `prisma db pull` adds the model to `prisma/schema.prisma`; both files are
committed together.

**Amenity codes** (closed, enforced in the zod schema, not the database): `caddie`, `cart`,
`driving_range`, `putting_green`, `clubhouse`, `restaurant`, `club_rental`, `pro_shop`, `lessons`,
`night_golf`.

## 4. api-v2

Route → Controller → Service → Repository, per the Layer Contract in api-v2's `CONTEXT.md`.

**`src/lib/golf/courseInput.ts`** — ported from v1 `src/lib/schemas/golf.ts`, catalogue parts only:

- `GOLF_AMENITIES` — the closed list above.
- `golfCourseInputSchema` (zod) — trims strings; requires `name`, `country`, `city`, `holes`;
  `holes` ∈ {9, 18, 27, 36}; `par` 27–144 or empty; `greenFeeFrom` ≥ 0 or empty; `currency` three
  uppercase letters; `imageUrls` each `https://` only; `amenities` from `GOLF_AMENITIES`; `slug`
  matching the slug CHECK, or empty.
- `slugify(...parts)` — NFKD, combining marks stripped, lowercased, non-alphanumerics collapsed to
  `-`, trimmed of `-`, at most 120 characters. Same function as v1.

**`src/repositories/golf.repository.ts`** — `GolfRepository`, Prisma `$queryRaw` in the style of
`destinations.repository.ts`:

- `listPublished({ country? })` — published only, ordered by name.
- `listPublishedCountries()` — distinct countries with at least one published course, ordered.
- `findBySlug(slug)` — any status; the service decides visibility.
- `listForAdmin({ q?, page, pageSize })` — all statuses; `q` matches name, city or country,
  case-insensitively; returns rows and a total.
- `create(input)`, `update(id, input)`, `setStatus(id, status)`, `delete(id)` — `update`,
  `setStatus` and `delete` return null / false for an unknown id. A unique violation on `slug`
  throws `SlugTakenError`.
- Maps rows to the camelCase `GolfCourse` domain type (`greenFeeFrom` as a number or null), as the
  Layer Contract gives the mapping to the repository.

**`src/services/golf.service.ts`** — `GolfService`:

- "Published only" is decided here, once. `getPublished(slug)` returns null for a draft.
- Generates the slug from `slugify(name, city)` when the input leaves it empty. A name and city
  with no letters a URL can use (all Hangul, say) produce no slug; that is a 422 asking for one.
- A malformed id is treated as an unknown one (null / false), never sent to Postgres as a uuid.
- `inCurrency(course, currency)` — converts `greenFeeFrom` into the requested Display Currency
  with `makeStrictConverter` (`src/lib/payments/convertStrict.ts`) over
  `ExchangeRatesService().getLiveRates()`, as `hotels.service.ts` does, rounding to two places.
  Skipped when there is no fee, no currency is asked for, or it equals the course's. On any
  conversion failure the course is returned unchanged.

**`src/controllers/golf.controller.ts`** — request in, service call, response and status code out.
Bodies are parsed with `golfCourseInputSchema` here rather than by the `validate()` middleware,
which checks but throws away the parsed (trimmed, defaulted) value.

Responses use the `{ success: true, data }` envelope `hotels.controller.ts` uses.

**Public routes** — `src/routes/golf.route.ts`, mounted at `/golf`, under the app-wide
`defaultRateLimit`:

| method | path | response |
|---|---|---|
| GET | `/golf/courses?country=&currency=` | `{ courses, countries }` |
| GET | `/golf/courses/:slug?currency=` | the course, or 404 for an unknown or draft slug |

**Admin routes** — `src/routes/admin-golf.route.ts`, mounted at `/admin/golf` (as `/admin/support`
is, which keeps them out of `admin.route.ts`) and **before** `/admin`, so no route in
`admin.route.ts` can shadow it; behind `requireAuth, requireRole('admin')`:

| method | path | notes |
|---|---|---|
| GET | `/admin/golf/courses?q=&page=` | `{ data, total, page, pageSize, totalPages }`, 20 per page |
| POST | `/admin/golf/courses` | create; 201 with the course |
| PUT | `/admin/golf/courses/:id` | update |
| PATCH | `/admin/golf/courses/:id/status` | `{ status: 'draft' \| 'published' }` |
| DELETE | `/admin/golf/courses/:id` | `{ success: true }` — not 204, because app-v2's `http` client parses every response body |

Errors: invalid input is a `ZodError`, which `error.middleware.ts` already answers with 422
`{ error: 'VALIDATION_ERROR', message, details }` (`details` is the zod field errors); 409
`SLUG_TAKEN` on `SlugTakenError`, with `details.slug` so the form can show it beside the field; 404
for an unknown id. Every successful write calls `logAdminAction` (`src/lib/admin/audit.ts`).

## 5. app-v2 storefront

Feature folder `src/features/golf/` (`api/`, `components/`, `lib/`). Pages follow the destination
page: a server route file for metadata, and a client view that fetches through `http`.

**`/golf`** — `app/[locale]/golf/page.tsx` → `features/golf/components/golf-list-view.tsx`.

- A heading, then country chips that link to `?country=` so a filtered list can be shared.
- A grid of course cards: cover image, name, city · country, holes, and "Green fees from {price}"
  when a fee is set.
- Empty states for "no published courses" and "none in this country".

**`/golf/[slug]`** — `app/[locale]/golf/[slug]/page.tsx` → `golf-course-view.tsx`.

- `page.tsx` fetches the course once on the server: the tab title is the course name, and an
  unknown or draft slug calls `notFound()`, so it is a real 404. Metadata uses
  `hreflangAlternates`.
- The view shows the cover with a thumbnail gallery, a facts row (holes, par, the "from" price),
  labelled amenities, the description split into paragraphs on blank lines, and the address.
- The main action is **Ask about tee times**.

Both views send the viewer's `useUserCurrency()` as `?currency=` and fetch again when it changes.
The browser never converts a price. Images are plain `<img>` elements, because admin URLs come from
any host.

**Ask about tee times.** `SupportWidget` opens through `useSupportChat().open()`, which dispatches
`opened_panel` to the hook's reducer and fetches the visitor's conversation on first open. Nothing
outside the widget can call it. A small zustand store, `features/support/lib/supportWidget.store.ts`
(like the search store), carries a request instead: `requestOpen()` bumps a counter, and the widget
subscribes and calls its own `open()` when the counter changes. The reducer, the fetch and the
panel stay where they are, and no message is pre-filled.

The widget exists only for someone signed in (ADR-0032). For a signed-out visitor the button sends
them to `/login?redirect=<this page>`, as checkout does, with a line saying sign-in is how they reach
the team.

**Entry points.**

- `features/landing/journey/Journey.tsx` — the Options panel's Golf card gets `href: '/golf'`, which
  makes it a link like the other two. `landing.journey.options.golfNote` changes from "Coming soon"
  to "Curated courses, tee times on request" (and its ko / ja / zh equivalents), and the comment
  above the card is removed.
- `features/search/components/immersive-search-bar.tsx` — a third pill, "Golf", after Stays and
  Flights. It is a `Link` to `/golf` styled as an inactive tab. It is not a `Mode`: `mode`,
  `handleSetMode` and `onModeSelect` are untouched. The three pills must fit at 360px wide.

## 6. app-v2 admin

`app/admin/(dashboard)/golf/page.tsx` → `features/admin/components/golf-courses-view.tsx`, built
like `destinations-view.tsx` with `http`, a search box, pagination, and the shared `input` and
`dialog`. English only (staff host).

- **Table:** cover thumbnail, name, city / country, holes, from-price with its currency, a
  draft / published badge, and actions: edit, publish or unpublish, delete after a confirmation.
- **Create / edit** in a dialog holding `golf-course-form.tsx`:
  - every field in §3 except the timestamps;
  - amenities as checkboxes;
  - image URLs one per line, the first being the cover;
  - the slug pre-filled from name + city until an admin edits it by hand;
  - field errors from a 422's `details` shown beside their fields.
- **Sidebar:** "Golf Courses", lucide `Flag` icon, after Destinations in `admin-sidebar.tsx`.
- Amenity labels come from the `golf` namespace, which `app/admin/layout.tsx` adds to the English
  messages it supplies (it passes only the namespaces staff screens read).

## 7. Localization

A new `golf` namespace in `src/locales/{en,ko,ja,zh}.json`: page titles, the country filter, facts
(`{holes} holes`, `Par {par}`, `Green fees from {price}`), amenity labels, the button, empty states,
and `landing.search.searchMode.golf` for the tab. The new non-English strings are added to
`src/locales/NEEDS_NATIVE_REVIEW.md`. app-v2 has no locale parity test, so one is added for the
`golf` namespace: ko, ja and zh carry exactly English's keys, and every amenity code has a label.
Course names and descriptions are shown as written.

## 8. Error handling

- **Storefront:** a failed API call shows the page's error state with a retry, never a partial page.
  An unknown or draft slug is a 404.
- **Admin:** the API's message is shown inside the dialog (app-v2 mounts no toaster), field errors
  beside their fields, and the dialog stays open with what was typed.
- **Currency:** a conversion that fails falls back to the course's own figure (§4).

## 9. Testing

Test-first, per task.

**api-v2**
- `golfCourseInput.test.ts` — schema accepts and rejects; `slugify` including accented names and
  the 120-character limit.
- `golf.service.test.ts` against an in-memory repository — drafts invisible to public reads, country
  filter, slug generated when empty, currency conversion, fallback when rates are missing.
- `golf.route.test.ts` (an Express app on an ephemeral port, like `bookings.route.order.test.ts`) —
  public 404, admin refuses a non-admin, 422 with field `details`, 409 for a taken slug, 404 for an
  unknown id, 201 on create.
- `golf.repository.test.ts` in the style of `flightLifecycle.repository.test.ts`.

**app-v2**
- `golf-course-form.test.tsx` — slug auto-fill stops after a manual edit; submits the parsed payload.
- List and course views — empty states, the price only when set, the gallery, the 404 path.
- Ask about tee times calls `requestOpen()` for someone signed in, and the widget opens when the
  request arrives; a signed-out visitor is sent to sign in.
- The search bar's Golf tab is a link to `/golf`, not a mode button.
- The Journey's Golf card links to `/golf`.
- The golf locale parity test.

**Manual** — `dbmate up` on 5434, then create and publish a course in admin, and check `/golf` and
the course page in two locales, in light and dark mode, and at 360px wide.

## 10. Docs

api-v2's `CONTEXT.md` gains a **Golf Course** entry: curated by the team, no supplier behind it, the
green fee is only a guide, and the support chat is the booking channel until slice 2.

## 11. Out of scope

Tee times and booking, extras, the policy and fact block (yardage, year opened, designer, grass,
weather rule, booking window), photo upload, the course portal, search by date and players, a
footer link, a sitemap entry, a home-page row, a header link, and golf in My Bookings.
