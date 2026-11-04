# Golf tee times (inventory) — design

**Date:** 2026-11-04
**Repos:** `cheapestgo-api-v2` (domain, ADR-0017) and `cheapestgo-app-v2` (UI)
**Branch:** `feat/golf-tee-times` in both, cut from `feat/golf-catalogue` (its PRs are open, so this
builds on them and its PRs are based on that branch)
**Builds on:** `2026-11-04-golf-catalogue-design.md`
**Level with v1:** `0cb892d6` on `cheapest-go-app` branch `feat/golf-courses`
**Status:** approved in conversation; golf piece 2a

## 1. Goal

Each course gets real tee times: an admin sets a course's time zone, booking window and weekly
tee-time schedules, tee times are generated from them, and a customer sees on the course page which
times are free on a date, for how many players, at what all-in price. Picking one opens the support
chat with a message naming it. Nothing is held or paid for yet.

Piece 2 of the golf port is split in two, each with its own spec, plan and build:

- **2a — inventory** (this document): time zone and booking window, schedules, generated tee times,
  "published means bookable", the tee-time picker.
- **2b — booking:** holds, the PaymentIntent with manual capture, request → confirm/decline, customer
  and team cancellation with refunds, the free-cancellation window, emails, the sweep cron, the
  webhook branch, booking pages and the admin bookings screen, all charged in the customer's
  currency (v1 ADR-0051).

## 2. Decisions

- **Tee times are stored rows**, generated from schedules, as in v1. 2b's oversell guard is one
  conditional `UPDATE … SET spots_left = spots_left - n WHERE spots_left >= n` on these rows, and
  piece 4's closures close them. Computing tee times per request would have to be redone in 2b.
- **The picker shows the all-in price per player** (v1 ADR-0047): green fee plus service fee, for
  the chosen party size (default 2, said on screen), in the viewer's currency. It comes from one
  function, `quoteGolf`, which 2b's checkout will charge from, so the price on the course page is
  the price on the card. The service fee has a flat part, so the per-player price depends on the
  party size.
- **Every tee-time price is shown in the visitor's currency.** A course prices its tee times in its
  own currency; the visitor sees them in the currency they picked in the header (KRW, USD, PHP, …).
  When they switch, the picker asks api-v2 again and every price on it changes to the new currency,
  converted on the server at the rate it quotes from (CONTEXT.md, "Display Currency"). The browser
  never converts. The course page's "green fee from" already behaves this way (the catalogue).
- **The booking window is per course** (v1 ADR-0047): `booking_window_days`, 1–90, default 60, limits
  generating and listing. The 24-hour minimum lead stays global: it is the time the team needs to
  check with the course.
- **Picking a time asks about it.** Until 2b, a chosen time opens the support chat with a draft
  message naming the course, date, time and players. The customer sends it; nothing is sent for them.
- **Published means bookable** (v1's rule), with one addition: the course's currency is locked
  alongside its time zone, because schedule prices are stored without a currency.
- **Schedules are added and deleted, not edited.** Editing in place, with its effect on existing
  tee times, comes with piece 4's tee-sheet control, as in v1.
- **The free-cancellation window waits for 2b**, the first piece that uses it.

## 3. Data

Migration `cheapestgo-api-v2/db/migrations/20261104000002_golf_tee_times.sql`, dbmate format, written
for v2 like the catalogue's (v1's rules restated, v1's version numbers not reused). `IF NOT EXISTS`
throughout; `migrate:down` drops the two tables and the two columns.

**`golf_courses` gains:**

| column | type | notes |
|---|---|---|
| `timezone` | `text` NULL | IANA name, checked by the API; a course without one cannot have schedules |
| `booking_window_days` | `integer` NOT NULL DEFAULT 60 | CHECK 1–90 |

**`golf_tee_time_schedules`** — a course's named weekly pattern.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `course_id` | `uuid` NOT NULL | FK `golf_courses`, `ON DELETE CASCADE`; indexed |
| `name` | `text` NOT NULL | e.g. "Weekday mornings" |
| `days_of_week` | `smallint[]` NOT NULL | 0 = Sunday … 6; non-empty, values 0–6 (CHECK) |
| `first_tee`, `last_tee` | `time` NOT NULL | course-local; CHECK `last_tee >= first_tee` |
| `interval_minutes` | `integer` NOT NULL | CHECK 5–60 |
| `spots` | `integer` NOT NULL DEFAULT 4 | CHECK 1–4 |
| `price_per_player` | `numeric(10,2)` NOT NULL | CHECK ≥ 0; in the course's currency |
| `created_at`, `updated_at` | `timestamptz` | |

Different prices for different times of day are separate schedules.

**`golf_tee_times`** — one row per start time.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `course_id` | `uuid` NOT NULL | FK, `ON DELETE CASCADE` |
| `schedule_id` | `uuid` NULL | FK, `ON DELETE SET NULL` |
| `starts_at` | `timestamptz` NOT NULL | |
| `spots` | `integer` NOT NULL | CHECK 1–4 |
| `spots_left` | `integer` NOT NULL | CHECK `0 ≤ spots_left ≤ spots`; moved only by 2b's bookings |
| `price_per_player` | `numeric(10,2)` NOT NULL | copied from the schedule at generation |
| `currency` | `char(3)` NOT NULL | the course's, at generation |
| `status` | `text` NOT NULL DEFAULT `'open'` | CHECK `open`, `closed` |
| `created_at` | `timestamptz` | |

`UNIQUE (course_id, starts_at)`: overlapping schedules cannot make the same tee time twice, because
generation is `ON CONFLICT DO NOTHING`. The unique index also serves the day listing.

## 4. Rules

| # | Rule | Answer |
|---|---|---|
| R1 | Publishing is refused unless the course has a time zone and at least one schedule. | 409 `COURSE_NOT_BOOKABLE` |
| R2 | A course's time zone and currency cannot change while it has schedules. | 409 `TIMEZONE_LOCKED` / `CURRENCY_LOCKED`, with `details` naming the field |
| R3 | A published course's last schedule cannot be deleted; unpublish it first. | 409 `LAST_SCHEDULE` |

Unpublishing, editing anything else, and deleting a draft's schedules are unaffected. Courses already
published without schedules stay published and show only "Ask about tee times", as now.

**Timing:**

- A tee time is listed only if it starts at least `MIN_LEAD_HOURS` (24) from now and within the
  course's booking window (plus a day for zone edges, as v1's `isBookableStart`).
- Generation fills each course's window from today, on the course's clock. It runs after a schedule
  is added (that course), after a course's time zone or window is saved (that course), and daily from
  the cron (every course with a time zone). Shortening a window deletes nothing; tee times beyond it
  are no longer listed.
- Deleting a schedule deletes its future tee times. Safe in 2a, where nothing can be booked; 2b
  changes this to keep tee times that carry bookings.

## 5. api-v2

**Pure helpers, `src/lib/golf/`** (unit-tested, no database):

- `time.ts` — v1's `Intl`-based zone arithmetic, unchanged: `isValidTimeZone`, `isIsoDate`,
  `zonedTimeToUtc(date, time, tz)`, `localDate`, `localTime`, `addDays`, `dayOfWeek`.
- `schedule.ts` — `expandSchedule(schedule, tz, fromDate, days)` → the instants it produces.
- `rules.ts` — `MIN_LEAD_HOURS = 24`, `DEFAULT_BOOKING_WINDOW_DAYS = 60`,
  `MAX_BOOKING_WINDOW_DAYS = 90`, `DEFAULT_PLAYERS = 2`, `isListableStart(startsAt, now, windowDays)`,
  and `listingRange(now, tz, windowDays)` → `{ firstDate, lastDate }` on the course's clock.
- `quote.ts` — `quoteGolf({ greenFeeTotal, currency, chargeCurrency, convert })` →
  `{ currency, rate, greenFee, serviceFee, total, markupRate }`. Converts the green fee with the
  strict converter it is given, puts the golf service fee on the converted figure, and rounds each
  part to the charge currency so they add up. Throws when the converter cannot convert.
- `scheduleInput.ts` — zod `scheduleInputSchema`: `name` (1–80), `daysOfWeek` (non-empty, 0–6,
  de-duplicated), `firstTee`/`lastTee` (`HH:MM`, last ≥ first), `intervalMinutes` (5–60), `spots`
  (1–4, default 4), `pricePerPlayer` (≥ 0).
- `courseInput.ts` gains `timezone` (a valid IANA name, or empty for none) and `bookingWindowDays`
  (1–90, default 60).

**`src/lib/pricing.ts`** gains `GOLF_MARKUP_SPEC` (`GOLF_MARKUP_PERCENTAGE`, `GOLF_MARKUP_FLAT_USD`,
defaulting to the hotel spec's values, as in v1), `golfServiceFee(base, currency, convert)` (the twin
of `hotelServiceFee`) and `roundToCurrency(amount, currency)` (whole units for zero-decimal
currencies, two places otherwise, using the same `ZERO_DECIMAL_CURRENCIES` as `toStripeAmount`).

**`src/repositories/golfTeeTimes.repository.ts`** — `listSchedules(courseId)`, `createSchedule`,
`deleteSchedule(courseId, scheduleId)` (also deletes that schedule's future tee times, in one
transaction), `countSchedules(courseId)`, `generationSources(courseId?)` (schedules joined with their
course's time zone, currency and window, time zone set only), `insertTeeTimes(rows)` (chunked,
`ON CONFLICT DO NOTHING`, returns the count), `listOpenTeeTimes(courseId, from, to)`.

**`src/services/golfTeeTimes.service.ts`** — `GolfTeeTimesService`:

- `listSchedules(courseId)`; `addSchedule(courseId, input)` (refuses a course without a time zone,
  then generates for that course and returns `{ schedule, created }`); `removeSchedule(courseId,
  scheduleId)` (R3).
- `generate({ courseId?, now })` → tee times created; one course failing is logged and skipped.
- `availability(slug, date, players, currency, now)` → null for a course that is not published and
  bookable; otherwise the open tee times on that course-local date, clamped to lead and window, each
  quoted once with rates fetched once. A tee time that cannot be quoted is returned without a price.

**`GolfService`** gains R1 (in `setStatus`) and R2 (in `update`), runs generation for the course after
an update that changes its time zone or window, and the `GolfCourse` type gains `timezone`,
`bookingWindowDays` and `bookable`.

**Endpoints:**

| method | path | answer |
|---|---|---|
| GET | `/golf/courses/:slug/tee-times?date=&players=&currency=` | `{ timezone, date, firstDate, lastDate, players, teeTimes: [{ id, startsAt, localTime, spotsLeft, allInPerPlayer, currency }] }`; `allInPerPlayer` and `currency` null when unpriced; 404 unknown / not bookable; 422 for a `date` that is not a calendar date |
| GET | `/admin/golf/courses/:id/schedules` | the course's schedules |
| POST | `/admin/golf/courses/:id/schedules` | 201 `{ schedule, created }` |
| DELETE | `/admin/golf/courses/:id/schedules/:scheduleId` | `{ success: true }`; 409 `LAST_SCHEDULE` |
| GET | `/cron/golf-generate-tee-times` | `{ success, created }`, CRON_SECRET auth |

A missing `date` means `firstDate`, and a date outside the range is answered for the nearest end of
it, so the picker never has to know the range before its first request. `players` outside 1–4 reads
as 2; `currency` is read as in the catalogue. Admin list rows gain
`bookable` and `scheduleCount`. The cron runs daily at 03:15 (`docker/cron/crontab`) and joins the
`run-cron` allowlist in `admin.route.ts`. Schedule writes call `logAdminAction`.

## 6. app-v2

**Course page** (`golf-course-view.tsx`). When `bookable`, the side panel becomes a tee-time picker
above the button:

- **Date:** a compact month grid (v1's `calendar.ts` logic, v2's look) bounded to
  `firstDate`…`lastDate`, opening on the URL's `date` when it is inside that range and on
  `firstDate` otherwise. (Before the first answer arrives the range is unknown, so the first request
  is made for the URL's date, or for no date, which the API answers for `firstDate`.)
- **Players:** 1–4, default 2.
- **Times:** a grid of buttons, "07:30 · 3 left · ₩57,400", priced in the visitor's currency from
  the header (`useUserCurrency()`, sent as `?currency=`). Switching the header currency re-fetches,
  and every price, the note and the draft message follow it. Selected time highlighted; the
  selection survives the switch. "Price on request" appears only if api-v2 has no exchange rate at
  all for that currency, never as a price in a currency the visitor did not choose.
- **Note:** "All-in price per player for {n} players, service fee included", and that the per-player
  price changes with the party size.
- **Empty day:** "No tee times left on this day — try another date." **Error:** a retry.
- **URL state:** `?date=&players=&time=` is replaced (no scroll) as the visitor picks, and read on
  load by the server page, so a link can be shared and a visitor sent to sign in returns to the same
  selection. A `time` that is no longer listed is dropped.

**Ask about this tee time.** `AskTeeTimesButton` takes an optional `draft`. With a time picked it
reads "Ask about this tee time" and calls `requestOpen(draft)`; with none it is the generic button.
Signed out, it goes to sign in as now. The draft is translated:
"Hi! I'd like to play {course} on {date} at {time} ({city} time) for {players} players. Is it
available?", with the date in the viewer's language and the time on the course's clock.

**Support store.** `requestOpen(draft?)` stores the draft beside the request counter. When the widget
opens for a request that carries one, `SupportPanel` puts it in its message box if the box is empty,
and focuses it. Nothing is sent automatically.

**Admin:**

- **Course form** gains *Time zone* (a select of `Intl.supportedValuesOf('timeZone')`) and *Booking
  window (days)*. While the course has schedules, time zone and currency are disabled with "Locked
  while this course has tee-time schedules".
- **Course table** gains a *Tee times* action opening a dialog: without a time zone it says to set
  one first; otherwise it lists schedules (name, days, "07:00–15:00 every 8 min", spots, price with
  currency, delete) and has an add form (name, Sun–Sat checkboxes, first and last tee, interval,
  spots, price) that reports "N tee times created". A draft that cannot be published shows "Not
  bookable: needs a time zone and a schedule"; publish refusals show the API's message.
- **Crons screen** (`crons-view.tsx`) lists *Golf Tee Times*, daily.

**i18n:** `golf.teeTimes.*` in en, ko, ja and zh, listed in `NEEDS_NATIVE_REVIEW.md`; the golf parity
test covers them.

## 7. Error handling

- **Rates unavailable:** tee times are listed without a price ("price on request"), never a guessed one.
- **Generation:** a course that fails is logged and skipped; the cron still answers with what it made.
- **Admin:** R1–R3 and validation errors are shown in the dialog or beside their field, as in the
  catalogue.
- **Picker:** a failed load offers a retry; a vanished selected time is dropped from the URL.

## 8. Testing

**api-v2**
- `time.ts` (including `America/New_York` across a DST change), `expandSchedule`, `listingRange`,
  `isListableStart`, `quoteGolf` (KRW rounding to whole won, parts adding up, a throwing converter),
  `golfServiceFee`, `roundToCurrency`, both schemas.
- Repository SQL shape with mocked Prisma, as in the catalogue.
- Service with fakes: R1, R2 (both fields), R3, generation after add and after a window change,
  availability clamped to lead and window, a USD course's tee times quoted in KRW (whole won), an
  unpriced tee time only when the converter throws.
- Routes over HTTP: the public tee-times answer, 404 and 422, admin schedules with role checks, cron
  auth.
- A real-database smoke run: add a schedule, see tee times generated on the course's clock, delete it.

**app-v2**
- The picker: refetches on date, players and currency; switching the header currency from USD to KRW
  shows every tee time in won and keeps the selected time; writes and reads URL state; picking a time
  gives the button its draft; empty day and error states.
- The store carries a draft into the panel's message box only when it is empty.
- The schedules dialog: list, add (reports the count), delete with R3's message; the form locks.
- Manual: a browser run on the course page and the admin dialog.

## 9. Out of scope

Holds, payment, request/confirm, cancellation and refunds, the free-cancellation window, emails and
the booking pages (2b); editing a schedule in place, closures and blocks (piece 4); extras, search by
date across courses, and the policy and fact block (piece 3).
