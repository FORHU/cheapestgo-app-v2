# Golf in the v2 design — design

**Date:** 2026-11-04
**Repo:** `cheapestgo-app-v2` only. No api-v2 change: everything here reads endpoints that exist.
**Branch:** `feat/golf-v2-design`, cut from `feat/golf-tee-times` (worktree
`cheapestgo-app-v2-golf-design`). Not cut in the `-nearby` worktree, which holds someone's uncommitted
edits to the same four locale files.
**Builds on:** `2026-11-04-golf-catalogue-design.md`, `2026-11-04-golf-tee-times-design.md`
**Status:** approved in conversation

## 1. Goal

Golf looks and moves like the rest of v2:

1. **On the landing page**, Golf is the search stage's third face. Choosing the Golf tab slides the
   panel and cross-fades the backdrop in place, exactly as Stays ↔ Flights do today. Until now the tab
   was a link that left the page.
2. **`/golf` and `/golf/[slug]`** take the current v2 design. The catalogue looks like My Bookings
   and the flight results. The course page looks like the property page.

## 2. Decisions

- **Golf is a face of the existing search stage, not a stage of its own.** A stage of its own would
  add a stretch of scroll track. A face is what "slides like Stays/Flights" means: same track position,
  different panel side, different photograph.
- **It docks center.** Stays docks left and Flights right, so each tab gets its own place. Moving
  between any two is a visible slide, and the center scrim already exists.
- **The face is a real search: a sentence plus course pills** (user's choice). *"Tee off at [course]
  on [date] for [2 players]."* GO opens the course page with the picker on that day. Up to four
  courses appear as pills under it, like the city pills under Stays.
- **The golf sentence is its own component.** The parts it shares with the stays/flights sentence move
  out of the bar into one file (user's choice over a third branch inside the 1,200-line bar, and over a
  second copy of the tab row). Staging rarely touches the bar, so the move is cheap to merge.
- **The backdrop is a photograph the user supplies**: `public/images/destinations/golf-dusk.webp`
  (user's choice). Until it exists, the face falls back to its own gradient, so nothing looks broken.
- **The landing fetches the catalogue in the browser, in the visitor's currency.** Golf never converts
  a fee in the browser (CONTEXT.md, "Display Currency"), so the pills do not use the landing's
  `useMoney`. They show `greenFeeFrom` exactly as api-v2 sends it.
- **The course page copies the property page's hero; it does not share it.** The hero is written into
  `property-view.tsx`, which staging is actively changing (room selection). Pulling the hero out now
  would conflict on every staging merge. Sharing it is a later, separate change.

## 3. Landing: the Golf face

### 3.1 Stage

`src/features/landing/journey/stages.ts`:

- `SearchMode` becomes `'stays' | 'flights' | 'golf'`.
- `Stage.faces` becomes `{ flights?: StageFace; golf?: StageFace }`. `faceOf` loses its
  `as 'flights'` cast and indexes by mode.
- `StageId` gains `'golf'`. Its wording keys are `landing.journey.stages.golf.{titleLead,titleRest,caption}`.
- The stays stage gains a golf face:
  - `side: 'center'`
  - `showcase: { kind: 'still', image: '/images/destinations/golf-dusk.webp', strength: 0.95 }`
  - `ground`: a dusk-green gradient, `linear-gradient(180deg,#0b1f17 0%,#14532d 55%,#3f7d4f 100%)`

The panel keeps the stage's width (`stage.side` is `left`, so 42rem). The 700ms margin transition
already moves it to `SIDE_OFFSET.center`.

### 3.2 Backdrop fallback

`src/features/landing/journey/StageShowcase.tsx`:

- `Still` takes an `onError`. When its photograph fails to load, it stops drawing the `<img>`.
- When a face's photograph has failed, `FaceLayer` paints that face's own `ground` in its layer.
  Today a face's `ground` is never painted; only the stage's is.
- A photograph that loads draws exactly as before. Stays and Flights do not change.

The idle preloader in `Journey.tsx` already gathers every face's photographs. Until the file is added it
logs one 404, which is expected.

### 3.3 Journey

`src/features/landing/journey/Journey.tsx`:

- `StageSurface` gets a `golf` case that renders `GolfSurface`.
- **`GolfSurface`** owns everything golf on the landing page:
  - It fetches `fetchGolfCatalogue({ currency })` once, when it first mounts. It mounts only while the
    Golf face is shown.
  - It fetches again when the display currency changes (`useUserCurrency`).
  - It renders `ImmersiveSearchBar` with `defaultMode="golf"`, the courses and the picked course.
  - It renders `CourseStrip` under the bar.
- **`CourseStrip`**:
  - Shows the first four courses in catalogue order, as pills in the `ShowcaseStrip` style: glass, with
    the brand wash and accent border when chosen.
  - Each pill shows the course name, plus `golf.greenFeesFrom` formatted with `formatCurrency` when
    `greenFeeFrom` is set.
  - Picking a pill fills the course token. The lit pill is the course the sentence holds, so it is
    always what GO opens.
  - A trailing "All courses →" pill links to `/golf`.
- **While loading:** four placeholder pills.
- **On error or an empty catalogue:** no strip.
- **Reduced motion:** the Golf face is listed as its own section through `stageFaces`, like Flights.

### 3.4 Search bar

`src/features/search/components/immersive-search-bar.tsx`:

- **Mode:** `Mode` gains `'golf'`.
- **Tabs:** the tab row maps `['stays', 'flights', 'golf']`, all as buttons. The golf `Link` and its
  comment go.
- **Picking a tab** goes through `handleSetMode`:
  - With `onModeSelect` (the Journey), it reports the mode.
  - Without it, the bar switches in place.
- **When `mode === 'golf'`,** the bar renders `<GolfSentence …/>` in place of its prose and GO pill.
  The tabs stay the bar's own.
- **New props, passed through to `GolfSentence`:**
  - `golfCourses?: GolfCourse[] | null`: `null` while loading, `[]` when there are none or the request
    failed.
    - Left out (`undefined`), `GolfSentence` fetches the catalogue itself in the display currency.
    - That is the case when a bar switches to Golf in place (the reduced-motion page, where no
      `onModeSelect` is given). It would otherwise show "no courses" for a catalogue it was never
      handed.
  - `coursePick?: { slug: string } | null`: a fresh object per pick, like `destinationPick`.
  - `onCourseChange?: (slug: string | null) => void`.

### 3.5 Shared sentence parts

New file `src/features/search/components/prose-parts.tsx`. These move here from the bar unchanged,
apart from the date cap:

- `Token`, `NotePanel` and their constants
- `CalendarGrid`, which gains an optional `maxDate: Date | null`; days after it are disabled like past days
- the GO pill, as `GoPill({ searching, shake, width, label, searchingLabel, onClick })`
- the date helpers (`startOfDay`, `sameDay`, `fmtDate`), `longestLine`, and the keyframes `<style>`
  block they need

The bar imports them back. Its stays and flights behaviour must not change; its existing tests are the
check.

### 3.6 GolfSentence

New file `src/features/golf/components/golf-sentence.tsx`.

**Course token**

- Reads `the course` until a course is picked, then the course's name.
- Its `NotePanel` contains:
  - a text field that filters by name, city or country, case-insensitively
  - up to 8 matching courses, each showing name, `city · country` and the from-fee when set
  - an "All courses →" link to `/golf`
- While `golfCourses` is `null` it says it is loading.
- When the catalogue is empty or failed, it says no courses are open yet and keeps the link.

**Date token**

- Reads `the first open day` until a date is picked. The date is optional.
- A single-day `CalendarGrid` with `maxDate` = today + the picked course's `bookingWindowDays`, and no
  cap until a course is picked.
- Changing to a course whose window ends before the picked date clears the date.

**Players token**

- 1–4, default 2, the same range and default as the tee-time picker.

**GO**

- With no course picked, the sentence shakes and opens the course panel, as Stays does with no
  destination.
- Otherwise it pushes `/golf/{slug}?players=N`, plus `&date=YYYY-MM-DD` when a date is picked.
- It is pending in a transition, like the bar's GO.
- The course page already reads those parameters (`src/app/[locale]/golf/[slug]/page.tsx`,
  `selection()`), and the picker opens on that day.
- With no date, api-v2 answers the first day that has an open tee time.

The sentence reports the picked slug through `onCourseChange` and accepts outside picks through
`coursePick`.

## 4. `/golf`: the catalogue

`src/features/golf/components/golf-list-view.tsx` and `golf-course-card.tsx` take My Bookings'
treatment (`src/app/[locale]/trips/page.tsx`):

- **Chrome:** `<FlatGround />` and `<LandingHeader tone="default" />` in place of the shared `Header`.
  No background of the page's own, so the flat ground shows.
- **Column:** `max-w-[1240px] mx-auto px-6`, the navbar's measure, so the list starts on the logo's line.
- **Heading:**
  - Title `golf.title`, set `text-lg font-bold md:text-2xl`.
  - One count line under it, `text-xs md:text-sm` muted. It is `golf.count` ("{count, plural, one {#
    course} other {# courses}}"), or `golf.countIn` ("… in {country}") under a country filter.
  - `golf.eyebrow` and `golf.subtitle` are no longer shown.
- **Country filter:** `rounded-full` pills. The chosen pill gets a blue wash and blue border, and the
  rest get the card surface with a hairline border. Still links, still `aria-current="page"`.
- **Card:**
  - `rounded-2xl overflow-hidden`, surface `bg-white dark:bg-slate-900`, `hover:shadow-lg
    dark:hover:shadow-black/40`. These are the booking cards' materials (`booking-card-parts.tsx`).
  - The cover keeps its 4:3 crop and slow zoom on hover.
  - Below it: the name in bold, `city · country` muted, a `rounded-full` holes chip and the from-fee
    in bold.
- **Loading:** `rounded-2xl` placeholders. The error and empty states keep `StateScreen`.

## 5. `/golf/[slug]`: a course

`src/features/golf/components/golf-course-view.tsx` takes the property page's design
(`src/features/hotels/components/property-view.tsx`).

### 5.1 Hero

New file `src/features/golf/components/course-hero.tsx`, copying the property page's hero design.
It shows:

- **Photos:** a full-height (`100vh`, min 320px) full-bleed pager over `course.imageUrls`, with the same
  fade, scale and drift between photos (framer-motion). While a photo decodes, a shimmer plays over a
  dark plate.
- **Shading:** the same bottom-heavy dark gradient.
- **Top left:** a back button. It goes back in history when the visitor came from a page on this site
  (`document.referrer` on this origin), otherwise to `/golf`.
- **Top right:** the icon-only `CurrencySelector` and the theme toggle as 44px glass circles.
- **Arrows and dots:** only when there is more than one photo.
- **Over the photo:** the course name (`clamp(44px,5.2vw,60px)`) with `city · country` under it, in
  the page column.
- **No photos:** the hero is drawn on the dark plate with the name, and no pager.

### 5.2 Body

- **Layout:** the property page's column (`SHELL_GUTTER` with its wider `sm:px-12 lg:px-20 xl:px-28`,
  inside `SHELL_CAP`). The ground follows the theme: `brandTheme(theme).ground`.
- **Reveal:** sections rise and fade in as they enter the viewport, the property page's `Reveal`
  behaviour copied into golf.
- **At `lg` and up, two columns:** content `1fr`, and a 360px panel.
- **Content, in order:**
  - holes and par as `rounded-full` chips
  - amenities as `rounded-full` pills
  - "About", with its title in `SECTION_HEADING`, then the paragraphs
  - the address
- **Panel:** `rounded-2xl`, the card surface, sticky at `top-6`. It holds the `TeeTimePicker` when
  `course.bookable`, otherwise the guide price and `AskTeeTimesButton`, as today.
- **Below `lg`:** the panel stacks under the content.
- **Breadcrumb:** removed; the back button replaces it. `golf.breadcrumb` stays in the message files
  until nothing uses it, then goes.
- **Loading, missing and error states:** keep their current behaviour, drawn on the same ground under
  a plain dark hero plate.

### 5.3 Tee-time picker restyle

`src/features/golf/components/tee-time-picker.tsx` changes in look only:

- Player and day buttons become `rounded-full`, and time slots `rounded-xl`.
- The chosen ones are filled with `BRAND.gradient` in white text with `BRAND.gradientShadow`.
- The rest get a hairline border.

Its state, address syncing, fetching and the draft it hands to support chat do not change.

## 6. Copy

New keys, in `en`, `ko`, `ja` and `zh`. The `ko`/`ja`/`zh` strings are added to
`src/locales/NEEDS_NATIVE_REVIEW.md` under a `golf` heading.

- `landing.journey.stages.golf.titleLead` / `titleRest` / `caption`: "Or" / "tee off." /
  "Real tee times at courses we work with, priced per player." ("Or" rather than Flights' "Then":
  golf is an alternative to the trip, not its next step.)
- `search.prose.teeOffAt` ("Tee off at "), `search.prose.onDay` (", on "),
  `search.prose.forPlayers` (", for "), `search.prose.theCourse` ("the course"),
  `search.prose.firstOpenDay` ("the first open day"),
  `search.prose.players` ("{count, plural, one {# player} other {# players}}")
- `search.golf.findCourse` (the panel's field placeholder), `search.golf.loading`, `search.golf.none`,
  `search.golf.allCourses` ("All courses →"), `landing.search.searchingGolf`
- `golf.count`, `golf.countIn`, `golf.back`

## 7. Error handling

- **Catalogue request fails on the landing page:** the course panel says no courses are open yet and
  links to `/golf`. There is no strip, and GO shakes. The rest of the landing page is unaffected.
- **Golf photo missing:** the face's own ground (§3.2).
- **Course unpublished between the landing fetch and GO:** the course page's existing 404.
- **A date the course has no tee times on:** the picker's existing empty-day state.

## 8. Testing

**New tests**

- `stages`: `faceOf(stage, 'golf')` returns the golf face, and `stageFaces` lists three faces.
- `StageShowcase`: a still that fires `error` is removed, and its face's ground is painted.
- `golf-sentence`:
  - picking a course from the panel fills the token
  - an outside `coursePick` fills it too
  - GO with no course shakes and opens the panel
  - GO pushes `/golf/{slug}?players=2`, with `&date=` when a date is picked
  - the calendar disables days after the booking window
  - changing to a shorter-window course clears the date
  - the loading, empty and error panels
  - with no `golfCourses` prop, it fetches the catalogue itself
- `immersive-search-bar`:
  - the Golf tab is a button that calls `onModeSelect('golf')`
  - without `onModeSelect`, it switches in place to the golf sentence
- `Journey`: switching to Golf mounts `GolfSurface` and fetches the catalogue in the display
  currency; the strip shows at most four courses plus "All courses".
- `landing-journey-keys` and `golf-locales`: every new key exists in all four locales.

**Existing tests**

- `golf-list-view`, `golf-course-view`, `tee-time-picker` and `immersive-search-bar` tests are updated
  where markup changed: the breadcrumb is gone and the Golf tab is now a button. Their behaviour
  assertions must still pass.

**Gate**

- `tsc` is clean and the full app suite passes.
- In a browser, at desktop and phone widths and in light and dark:
  - the landing page: tabs sliding across all three faces, the golf sentence end to end, the pills
  - `/golf`
  - a course page, both one with tee times and one without

## 9. Out of scope

- The golf photograph itself (the user supplies it).
- Sharing the hero between the property page and the course page.
- Any change to golf data, the API, booking (piece 2b) or the admin screens.
- The Options stage's Golf card, which stays as it is.
