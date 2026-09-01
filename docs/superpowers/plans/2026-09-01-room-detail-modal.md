# Room Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat "ROOM" list in the property page's room-detail modal with a Booking.com-style categorised layout (key facts + one header per amenity category + free-text "Additional information"), fed by ETG `hotel/info` content that the API fetches on demand and caches.

**Architecture:** The API (`cheapestgo-api-v2`) fetches ETG content in `getProperty`, matches each TGX room to an ETG room-group by name, classifies the room-group's flat amenity slugs into sections, and attaches a typed `content` object per room plus property-level policy sections. The frontend (`cheapestgo-app-v2`) modal is a presentational renderer of that object, degrading to today's compact body when `content` is absent.

**Tech Stack:** TypeScript, Express + Prisma (Postgres) on the API; Next.js + React + Tailwind + lucide-react + framer-motion on the frontend. Vitest on both. TGX = TravelgateX/OTV (booking supplier). ETG = WorldOTA/RateHawk `hotel/info` (content).

**Two repos, run separately** (both use `pnpm`; if a machine only has `npm`, substitute `npm run`):
- API: `c:\Users\USER\Documents\GitHub\cheapestgo-api-v2` — tests `pnpm test` (vitest), single file `pnpm vitest run <path>`, types `pnpm type-check`, migration `pnpm prisma migrate dev`
- Frontend: `c:\Users\USER\Documents\GitHub\cheapestgo-app-v2` — tests `pnpm test`, single file `pnpm vitest run <path>`, types `pnpm type-check`

Each task is committed in the repo it touches. Phase 1 tasks commit in the API repo; Phase 2 in the frontend repo.

**Reference:** `cheapestgo-app-v2/docs/superpowers/specs/2026-09-01-room-detail-modal-design.md`. Never run `next build` while the dev server is up — use `pnpm type-check`.

---

## Shared type contract (both repos must match)

These names are used across many tasks. Copy verbatim.

```ts
type SectionId =
  | 'room-layout' | 'toiletries' | 'food-drink' | 'bathroom' | 'internet-comms'
  | 'room-amenities' | 'media-tech' | 'kitchen' | 'general' | 'child-policy' | 'beds-extra';

interface DetailItem { label: string; icon?: string; note?: string }

interface DetailSection {
  id: SectionId;
  title: string;
  scope: 'room' | 'property';
  items: DetailItem[];
}

interface AmenityGroup { groupName: string; amenities: string[]; nonFree: string[] }

interface RoomContent {
  gallery: string[];
  matchedRoomName?: string;
  keyFacts: DetailItem[];
  bedLine?: string;
  bedsExtraSummary?: string;
  sections: DetailSection[];        // room-scoped only
}
```

Canonical order and titles (API `roomContent.ts`, FE `room-content.ts` — identical):

```ts
const SECTION_ORDER: SectionId[] = [
  'room-layout', 'toiletries', 'food-drink', 'bathroom', 'internet-comms',
  'room-amenities', 'media-tech', 'kitchen', 'general', 'child-policy', 'beds-extra',
];
const SECTION_TITLES: Record<SectionId, string> = {
  'room-layout':    'Room layout and furnishings',
  'toiletries':     'Toiletries',
  'food-drink':     'Food and drink',
  'bathroom':       'Bathroom',
  'internet-comms': 'Internet and communications',
  'room-amenities': 'Room amenities',
  'media-tech':     'Media and technology',
  'kitchen':        'Kitchen facilities',
  'general':        'General amenities',
  'child-policy':   'Child policies',
  'beds-extra':     'Cribs and extra beds',
};
const ROOM_SCOPED = new Set<SectionId>([
  'room-layout', 'toiletries', 'food-drink', 'bathroom', 'internet-comms',
  'room-amenities', 'media-tech', 'kitchen', 'general',
]);
```

---

# Phase 1 — API (`cheapestgo-api-v2`)

All paths in Phase 1 are relative to `c:\Users\USER\Documents\GitHub\cheapestgo-api-v2`.

## Task 1: Prisma migration — add ETG content columns

**Files:**
- Modify: `prisma/schema.prisma` (model `hotel_content`, around line 446)
- Create: `prisma/migrations/<timestamp>_hotel_content_etg_columns/migration.sql` (generated)

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, inside `model hotel_content`, after the existing `room_groups` line, add:

```prisma
  metapolicy_struct     Json?
  metapolicy_extra_info String?
  etg_content_seeded_at DateTime? @db.Timestamptz(6)
```

(`amenity_groups`, `room_groups`, `important_information` already exist — leave them.)

- [ ] **Step 2: Generate and apply the migration**

Run: `pnpm prisma migrate dev --name hotel_content_etg_columns`
Expected: creates `prisma/migrations/<timestamp>_hotel_content_etg_columns/`, applies it, regenerates the client. Output ends `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the client picked up the fields**

Run: `pnpm type-check`
Expected: PASS (no errors — the new fields are optional so nothing else breaks).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(hotels): add ETG content columns to hotel_content"
```

---

## Task 2: Shared section types + ETG content parsers

Pure functions that turn a raw ETG `hotel/info` `data` object into our shapes. No I/O.
Also creates `roomContent.types.ts` up front because Task 4 imports `SectionId` from it.

**Files:**
- Create: `src/lib/hotels/roomContent.types.ts`
- Create: `src/lib/hotels/etgContent.types.ts`
- Create: `src/lib/hotels/etgContent.ts`
- Test: `src/__tests__/etgContent.parse.test.ts`

- [ ] **Step 0: Write `src/lib/hotels/roomContent.types.ts`**

Transcribe the **Shared type contract** block from the top of this plan verbatim —
`SectionId`, `DetailItem`, `DetailSection`, `AmenityGroup`, `RoomContent`, plus the
`SECTION_ORDER`, `SECTION_TITLES`, `ROOM_SCOPED` consts. `export` every name.

- [ ] **Step 1: Write the ETG types file**

`src/lib/hotels/etgContent.types.ts`:

```ts
export type { AmenityGroup } from './roomContent.types';

export interface RoomGroupEntry {
  name: string;
  images: string[];
  roomAmenities: string[];   // raw ETG slugs, lowercase-hyphen
  beddingType?: string;      // name_struct.bedding_type, e.g. "double bed"
  bathroomType?: string;     // name_struct.bathroom, e.g. "private"
  roomGroupId?: number;
}

export interface MetapolicyEntry {
  inclusion?: string;        // "included" | "paid" | "not_available" | ...
  price?: number;
  currency?: string;
  price_unit?: string;       // "per_night" | "per_day" | "per_stay"
  amount?: number;
  age_start?: number;
  age_end?: number;
  extra_bed?: string;
  internet_type?: string;
  work_area?: string;
  territory_type?: string;
  meal_type?: string;
}

export interface MetapolicyStruct {
  children?: MetapolicyEntry[];
  children_meal?: MetapolicyEntry[];
  cot?: MetapolicyEntry[];
  extra_bed?: MetapolicyEntry[];
  internet?: MetapolicyEntry[];
  parking?: MetapolicyEntry[];
  pets?: MetapolicyEntry[];
  deposit?: MetapolicyEntry[];
  no_show?: MetapolicyEntry[];
}

export interface EtgContent {
  roomGroups: RoomGroupEntry[];
  amenityGroups: AmenityGroup[];
  metapolicy: MetapolicyStruct | null;
  metapolicyExtraInfo: string | null;
  importantInformation: string | null;
}
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/etgContent.parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseRoomGroups, parseAmenityGroups, parseMetapolicy } from '@/lib/hotels/etgContent';

describe('parseRoomGroups', () => {
  it('returns [] for empty / null input', () => {
    expect(parseRoomGroups([])).toEqual([]);
    expect(parseRoomGroups(null)).toEqual([]);
  });

  it('resolves {size} in image URLs and caps at 10', () => {
    const out = parseRoomGroups([{
      name: 'Standard Room',
      images: Array.from({ length: 14 }, (_, i) => `https://cdn/x/{size}/${i}.jpg`),
      room_amenities: ['wi-fi'],
    }]);
    expect(out[0].images).toHaveLength(10);
    expect(out[0].images[0]).toBe('https://cdn/x/1024x768/0.jpg');
  });

  it('extracts beddingType and bathroomType from name_struct, renames room_amenities', () => {
    const out = parseRoomGroups([{
      name: 'Deluxe Twin Room',
      images: [],
      room_amenities: ['wi-fi', 3, null, 'tv'],
      room_group_id: 42,
      name_struct: { main_name: 'Deluxe Twin Room', bedding_type: 'twin beds', bathroom: 'private' },
    }]);
    expect(out[0].beddingType).toBe('twin beds');
    expect(out[0].bathroomType).toBe('private');
    expect(out[0].roomAmenities).toEqual(['wi-fi', 'tv']);
    expect(out[0].roomGroupId).toBe(42);
    expect(out[0]).not.toHaveProperty('floor');
  });

  it('drops entries with no name', () => {
    expect(parseRoomGroups([{ name: '', images: [], room_amenities: [] }])).toEqual([]);
  });
});

describe('parseAmenityGroups', () => {
  it('keeps group_name, amenities, non_free_amenities; filters blanks and drops empty groups', () => {
    const out = parseAmenityGroups([
      { group_name: 'Internet', amenities: ['Free WiFi', ''], non_free_amenities: [] },
      { group_name: '', amenities: ['x'] },
    ]);
    expect(out).toEqual([{ groupName: 'Internet', amenities: ['Free WiFi'], nonFree: [] }]);
  });
});

describe('parseMetapolicy', () => {
  it('returns null for null / non-object', () => {
    expect(parseMetapolicy(null)).toBeNull();
    expect(parseMetapolicy('nope')).toBeNull();
  });
  it('returns null when every known key is missing or an empty array', () => {
    expect(parseMetapolicy({ cot: [], junk: 1 })).toBeNull();
  });
  it('passes through known non-empty arrays', () => {
    const mp = parseMetapolicy({ cot: [{ inclusion: 'paid', price: 20, currency: 'EUR' }], junk: 1 });
    expect(mp?.cot?.[0]).toMatchObject({ inclusion: 'paid', price: 20, currency: 'EUR' });
  });
});
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `pnpm vitest run src/__tests__/etgContent.parse.test.ts`
Expected: FAIL — `parseRoomGroups` is not exported.

- [ ] **Step 3: Implement the parsers**

`src/lib/hotels/etgContent.ts` (parsers only — `ensureEtgContent` comes in Task 7):

```ts
import type {
  RoomGroupEntry, AmenityGroup, MetapolicyStruct, MetapolicyEntry,
} from './etgContent.types';

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : [];

function resolveImageUrl(u: unknown): string | null {
  if (typeof u === 'string') return u.replace(/\{size\}/g, '1024x768');
  if (u && typeof u === 'object') {
    const s = (u as any).url ?? (u as any).src;
    return typeof s === 'string' ? s.replace(/\{size\}/g, '1024x768') : null;
  }
  return null;
}

export function parseRoomGroups(raw: unknown): RoomGroupEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rg: any): RoomGroupEntry => {
      const entry: RoomGroupEntry = {
        name: typeof rg?.name === 'string' ? rg.name : '',
        images: (Array.isArray(rg?.images) ? rg.images : [])
          .map(resolveImageUrl)
          .filter((s: string | null): s is string => !!s)
          .slice(0, 10),
        roomAmenities: strings(rg?.room_amenities),
      };
      const bedding = rg?.name_struct?.bedding_type;
      if (typeof bedding === 'string' && bedding) entry.beddingType = bedding;
      const bathroom = rg?.name_struct?.bathroom;
      if (typeof bathroom === 'string' && bathroom) entry.bathroomType = bathroom;
      if (typeof rg?.room_group_id === 'number') entry.roomGroupId = rg.room_group_id;
      return entry;
    })
    .filter((rg) => rg.name);
}

export function parseAmenityGroups(raw: unknown): AmenityGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g: any): AmenityGroup => ({
      groupName: typeof g?.group_name === 'string' ? g.group_name : '',
      amenities: strings(g?.amenities),
      nonFree: strings(g?.non_free_amenities),
    }))
    .filter((g) => g.groupName);
}

const MP_KEYS: (keyof MetapolicyStruct)[] = [
  'children', 'children_meal', 'cot', 'extra_bed', 'internet',
  'parking', 'pets', 'deposit', 'no_show',
];

export function parseMetapolicy(raw: unknown): MetapolicyStruct | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: MetapolicyStruct = {};
  for (const key of MP_KEYS) {
    const v = src[key];
    if (!Array.isArray(v)) continue;
    const entries = v.filter((e): e is MetapolicyEntry => !!e && typeof e === 'object' && !Array.isArray(e));
    if (entries.length) out[key] = entries;
  }
  return Object.keys(out).length ? out : null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/__tests__/etgContent.parse.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotels/roomContent.types.ts src/lib/hotels/etgContent.types.ts src/lib/hotels/etgContent.ts src/__tests__/etgContent.parse.test.ts
git commit -m "feat(hotels): shared section types + ETG hotel/info content parsers"
```

---

## Task 3: Port `matchEtgRoomGroup`

Fuzzy-matches a TGX room description to one of the ETG room-groups. Ported from V1 `cheapest-go-app/src/lib/server/stays/travelgatex/search.ts:439-547`, adapted to return the whole `RoomGroupEntry`.

**Files:**
- Create: `src/lib/hotels/roomMatch.ts`
- Test: `src/__tests__/roomMatch.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/roomMatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchEtgRoomGroup } from '@/lib/hotels/roomMatch';
import type { RoomGroupEntry } from '@/lib/hotels/etgContent.types';

const g = (o: Partial<RoomGroupEntry>): RoomGroupEntry =>
  ({ name: 'Room', images: [], roomAmenities: [], ...o });

describe('matchEtgRoomGroup', () => {
  it('returns null when there are no groups', () => {
    expect(matchEtgRoomGroup('Standard Double Room', [])).toBeNull();
  });

  it('bedding-type pass distinguishes twin from double', () => {
    const groups = [
      g({ name: 'Standard Twin Room',   beddingType: 'twin beds',  images: ['a'] }),
      g({ name: 'Standard Double Room', beddingType: 'double bed', images: ['b'] }),
    ];
    expect(matchEtgRoomGroup('Standard Double Room', groups)?.name).toBe('Standard Double Room');
  });

  it('exact name match beats prefix match', () => {
    const groups = [
      g({ name: 'Deluxe Room',            images: ['a'] }),
      g({ name: 'Deluxe Room with View',  images: ['b'] }),
    ];
    expect(matchEtgRoomGroup('Deluxe Room', groups)?.name).toBe('Deluxe Room');
  });

  it('strips a TGX parenthetical qualifier before matching', () => {
    const groups = [g({ name: 'Superior King Room', images: ['a'] })];
    expect(matchEtgRoomGroup('Superior King Room (bed type is subject to availability)', groups)?.name)
      .toBe('Superior King Room');
  });

  it('returns null rather than matching on a tier word alone', () => {
    const groups = [
      g({ name: 'Standard Queen Room', images: ['a'] }),
      g({ name: 'Standard King Room',  images: ['b'] }),
    ];
    expect(matchEtgRoomGroup('Standard Family Suite', groups)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`matchEtgRoomGroup` not exported).

Run: `pnpm vitest run src/__tests__/roomMatch.test.ts`

- [ ] **Step 3: Implement**

`src/lib/hotels/roomMatch.ts` — port of V1's cascade. Read `cheapest-go-app/src/lib/server/stays/travelgatex/search.ts:439-547` and transcribe, with these adaptations: input groups are `RoomGroupEntry[]`; `g.beddingType` replaces `g.beddingType`; return the matched `RoomGroupEntry` or `null` (not `{ images, amenities, matchedName }`).

```ts
import type { RoomGroupEntry } from './etgContent.types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const BED_TYPES = new Set([
  'twin', 'single', 'triple', 'quadruple', 'quintuple', 'sextuple',
  'suite', 'villa', 'loft', 'cottage', 'bungalow', 'dormitory',
]);
const TIER_WORDS = new Set([
  'deluxe', 'standard', 'superior', 'executive', 'premium', 'premier', 'luxury',
]);
const BEDDING_WORDS = new Set(['double', 'twin', 'king', 'queen', 'single']);

const imgCount = (g: RoomGroupEntry) => g.images?.length ?? 0;

export function matchEtgRoomGroup(
  description: string,
  groups: RoomGroupEntry[],
): RoomGroupEntry | null {
  if (!groups?.length) return null;

  const seen = new Set<string>();
  const deduped = groups.filter((g) => {
    const k = norm(g.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const withPhotos = deduped.filter((g) => imgCount(g) > 0);

  const descFull     = norm(description.replace(/[()]/g, ' '));
  const descStripped = norm(description.replace(/\([^)]*\)/g, ''));

  const richest = (cs: RoomGroupEntry[]) => cs.reduce((a, b) => (imgCount(b) > imgCount(a) ? b : a));
  const toMatch = (cs: RoomGroupEntry[]) => cs.reduce((a, b) => (imgCount(b) >= imgCount(a) ? b : a));

  const exactMatches  = (d: string) => deduped.filter((g) => norm(g.name) === d);
  const prefixMatches = (d: string) => deduped.filter((g) => {
    const gn = norm(g.name);
    return gn !== d && (d.startsWith(gn) || gn.startsWith(d));
  });

  const words    = descFull.split(' ');
  const bedWord  = words.find((w) => BED_TYPES.has(w));
  const tierWord = words.find((w) => TIER_WORDS.has(w));
  const beddingWord = words.find((w) => BEDDING_WORDS.has(w));

  // Pass 0 — structured bedding-type
  if (beddingWord) {
    const byBedding = withPhotos.filter(
      (g) => g.beddingType && norm(g.beddingType).includes(beddingWord),
    );
    if (byBedding.length === 1) return byBedding[0];
    if (byBedding.length > 1) {
      if (tierWord) {
        const byBoth = byBedding.filter((g) => norm(g.name).includes(tierWord));
        if (byBoth.length) return richest(byBoth);
      }
      return richest(byBedding);
    }
  }

  // Pass 1 — full description
  const fe = exactMatches(descFull);
  const fep = fe.filter((g) => imgCount(g) > 0);
  if (fep.length) return richest(fep);
  if (fe.length)  return toMatch(fe);
  const fp = prefixMatches(descFull);
  const fpp = fp.filter((g) => imgCount(g) > 0);
  if (fpp.length) return richest(fpp);
  if (fp.length)  return toMatch(fp);

  // Pass 2 — stripped description
  if (descStripped !== descFull) {
    const se = exactMatches(descStripped);
    const sep = se.filter((g) => imgCount(g) > 0);
    if (sep.length) return richest(sep);
    if (se.length)  return toMatch(se);
    const sp = prefixMatches(descStripped);
    const spp = sp.filter((g) => imgCount(g) > 0);
    if (spp.length) return richest(spp);
    if (sp.length)  return toMatch(sp);
  }

  // Pass 3 — bed-type keyword (never tier words)
  if (bedWord) {
    const byBedPhoto = withPhotos.filter((g) => norm(g.name).includes(bedWord));
    if (tierWord && byBedPhoto.length > 1) {
      const byBoth = byBedPhoto.filter((g) => norm(g.name).includes(tierWord));
      if (byBoth.length) return richest(byBoth);
    }
    if (byBedPhoto.length) return richest(byBedPhoto);
    const byBedAny = deduped.filter((g) => norm(g.name).includes(bedWord));
    if (byBedAny.length) return toMatch(byBedAny);
  }

  // No tier-word fallback — an unmatched room is honest.
  return null;
}
```

- [ ] **Step 4: Run tests — expect PASS.**

Run: `pnpm vitest run src/__tests__/roomMatch.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotels/roomMatch.ts src/__tests__/roomMatch.test.ts
git commit -m "feat(hotels): port matchEtgRoomGroup from V1"
```

---

## Task 4: Room-amenity classifier

Maps one ETG room-amenity slug to `{ label, section, icon }`.

**Files:**
- Create: `src/lib/hotels/roomAmenities.ts`
- Test: `src/__tests__/roomAmenities.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/roomAmenities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyRoomAmenity } from '@/lib/hotels/roomAmenities';

describe('classifyRoomAmenity', () => {
  it('maps a known bathroom slug', () => {
    expect(classifyRoomAmenity('private-bathroom')).toEqual({
      label: 'Private bathroom', section: 'bathroom', icon: 'bath',
    });
  });
  it('maps a known kitchen slug', () => {
    expect(classifyRoomAmenity('microwave').section).toBe('kitchen');
  });
  it('maps wi-fi to internet-comms', () => {
    expect(classifyRoomAmenity('wi-fi').section).toBe('internet-comms');
  });
  it('routes a *-view slug to room-layout via regex fallback', () => {
    expect(classifyRoomAmenity('lake-view')).toEqual({
      label: 'Lake view', section: 'room-layout', icon: 'view',
    });
  });
  it('defaults an unknown slug to room-amenities with a prettified label', () => {
    expect(classifyRoomAmenity('rain-dance-floor')).toEqual({
      label: 'Rain dance floor', section: 'room-amenities', icon: 'check',
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/__tests__/roomAmenities.test.ts`

- [ ] **Step 3: Implement**

`src/lib/hotels/roomAmenities.ts`:

```ts
import type { SectionId } from './roomContent.types';

interface Classified { label: string; section: SectionId; icon: string }

function prettify(slug: string): string {
  const s = slug.replace(/-/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Exact slug → { label, section, icon }. First the specific ones.
const MAP: Record<string, Classified> = {
  // bathroom
  'private-bathroom':  { label: 'Private bathroom', section: 'bathroom', icon: 'bath' },
  'shared-bathroom':   { label: 'Shared bathroom',  section: 'bathroom', icon: 'bath' },
  'shower':            { label: 'Shower',           section: 'bathroom', icon: 'shower' },
  'bath':             { label: 'Bathtub',          section: 'bathroom', icon: 'bath' },
  'bathtub':          { label: 'Bathtub',          section: 'bathroom', icon: 'bath' },
  'bidet':            { label: 'Bidet',            section: 'bathroom', icon: 'bath' },
  'jacuzzi':          { label: 'Jacuzzi',          section: 'bathroom', icon: 'bath' },
  'hot-tub':          { label: 'Hot tub',          section: 'bathroom', icon: 'bath' },
  'toilet':          { label: 'Private toilet',   section: 'bathroom', icon: 'bath' },
  'toilet-paper':    { label: 'Toilet paper',     section: 'bathroom', icon: 'toiletries' },
  // toiletries
  'toiletries':      { label: 'Free toiletries',  section: 'toiletries', icon: 'toiletries' },
  'free-toiletries': { label: 'Free toiletries',  section: 'toiletries', icon: 'toiletries' },
  'shampoo':         { label: 'Shampoo',          section: 'toiletries', icon: 'toiletries' },
  'soap':            { label: 'Soap',             section: 'toiletries', icon: 'toiletries' },
  'conditioner':     { label: 'Conditioner',      section: 'toiletries', icon: 'toiletries' },
  'body-wash':       { label: 'Body wash',        section: 'toiletries', icon: 'toiletries' },
  'towels':          { label: 'Towels',           section: 'toiletries', icon: 'toiletries' },
  'slippers':        { label: 'Slippers',         section: 'toiletries', icon: 'toiletries' },
  'bathrobe':        { label: 'Bathrobe',         section: 'toiletries', icon: 'toiletries' },
  'hairdryer':       { label: 'Hair dryer',       section: 'bathroom',   icon: 'check' },
  'hair-dryer':      { label: 'Hair dryer',       section: 'bathroom',   icon: 'check' },
  'dental-kit':      { label: 'Dental kit',       section: 'toiletries', icon: 'toiletries' },
  // food & drink
  'minibar':         { label: 'Minibar',          section: 'food-drink', icon: 'fridge' },
  'coffee':          { label: 'Coffee maker/teapot', section: 'food-drink', icon: 'coffee' },
  'coffee-machine':  { label: 'Coffee machine',   section: 'food-drink', icon: 'coffee' },
  'tea-or-coffee':   { label: 'Coffee/tea for guests', section: 'food-drink', icon: 'coffee' },
  'kettle':          { label: 'Kettle',           section: 'food-drink', icon: 'coffee' },
  'electric-kettle': { label: 'Electric kettle',  section: 'food-drink', icon: 'coffee' },
  'bottled-water':   { label: 'Bottled water',    section: 'food-drink', icon: 'check' },
  // kitchen
  'kitchen':         { label: 'Kitchen',          section: 'kitchen', icon: 'kitchen' },
  'kitchenette':     { label: 'Kitchenette',      section: 'kitchen', icon: 'kitchen' },
  'fridge':          { label: 'Refrigerator',     section: 'kitchen', icon: 'fridge' },
  'refrigerator':    { label: 'Refrigerator',     section: 'kitchen', icon: 'fridge' },
  'microwave':       { label: 'Microwave',        section: 'kitchen', icon: 'kitchen' },
  'dishwasher':      { label: 'Dishwasher',       section: 'kitchen', icon: 'kitchen' },
  'toaster':         { label: 'Toaster',          section: 'kitchen', icon: 'kitchen' },
  'oven':            { label: 'Oven',             section: 'kitchen', icon: 'kitchen' },
  'stove':           { label: 'Stovetop',         section: 'kitchen', icon: 'kitchen' },
  'stovetop':        { label: 'Stovetop',         section: 'kitchen', icon: 'kitchen' },
  'cookware':        { label: 'Kitchenware',      section: 'kitchen', icon: 'kitchen' },
  'kitchenware':     { label: 'Kitchenware',      section: 'kitchen', icon: 'kitchen' },
  'dining-table':    { label: 'Dining table',     section: 'kitchen', icon: 'kitchen' },
  // internet & comms
  'wi-fi':           { label: 'Free Wi-Fi',       section: 'internet-comms', icon: 'wifi' },
  'wifi':            { label: 'Free Wi-Fi',       section: 'internet-comms', icon: 'wifi' },
  'wired-internet':  { label: 'Wired internet',   section: 'internet-comms', icon: 'wifi' },
  'internet':        { label: 'Internet access',  section: 'internet-comms', icon: 'wifi' },
  'telephone':       { label: 'Telephone',        section: 'internet-comms', icon: 'phone' },
  // media & tech
  'tv':              { label: 'TV',               section: 'media-tech', icon: 'tv' },
  'television':      { label: 'TV',               section: 'media-tech', icon: 'tv' },
  'cable-tv':        { label: 'Cable channels',   section: 'media-tech', icon: 'tv' },
  'satellite-tv':    { label: 'Satellite channels', section: 'media-tech', icon: 'tv' },
  'flat-screen-tv':  { label: 'Flat-screen TV',   section: 'media-tech', icon: 'tv' },
  'streaming':       { label: 'Streaming service', section: 'media-tech', icon: 'tv' },
  'dvd-player':      { label: 'DVD player',       section: 'media-tech', icon: 'tv' },
  'radio':           { label: 'Radio',            section: 'media-tech', icon: 'tv' },
  // room layout
  'wardrobe':        { label: 'Wardrobe/closet',  section: 'room-layout', icon: 'wardrobe' },
  'closet':          { label: 'Wardrobe/closet',  section: 'room-layout', icon: 'wardrobe' },
  'desk':            { label: 'Desk',             section: 'room-layout', icon: 'desk' },
  'sofa':            { label: 'Sofa',             section: 'room-layout', icon: 'check' },
  'sofa-bed':        { label: 'Sofa bed',         section: 'room-layout', icon: 'bed' },
  'seating-area':    { label: 'Seating area',     section: 'room-layout', icon: 'check' },
  'clothes-rack':    { label: 'Clothes rack',     section: 'room-layout', icon: 'wardrobe' },
  'blackout-curtains': { label: 'Blackout curtains', section: 'room-layout', icon: 'window' },
  'soundproofing':   { label: 'Soundproofing',    section: 'room-layout', icon: 'check' },
  'connecting-rooms': { label: 'Connecting rooms available', section: 'room-layout', icon: 'check' },
  'private-entrance': { label: 'Private entrance', section: 'room-layout', icon: 'check' },
  'balcony':         { label: 'Balcony',          section: 'room-layout', icon: 'window' },
  'terrace':         { label: 'Terrace',          section: 'room-layout', icon: 'window' },
  'patio':           { label: 'Patio',            section: 'room-layout', icon: 'window' },
  // general
  'safe':            { label: 'Safe in room',     section: 'general', icon: 'safe' },
  'in-room-safe':    { label: 'Safe in room',     section: 'general', icon: 'safe' },
  'safe-deposit-box': { label: 'Safe-deposit box', section: 'general', icon: 'safe' },
  'alarm-clock':     { label: 'Alarm clock',      section: 'general', icon: 'check' },
  'wake-up-service': { label: 'Wake-up service',  section: 'general', icon: 'check' },
  'hypoallergenic':  { label: 'Hypoallergenic',   section: 'general', icon: 'check' },
  // room amenities (climate / bedding / policy)
  'air-conditioning': { label: 'Air conditioning', section: 'room-amenities', icon: 'ac' },
  'heating':         { label: 'Heating',          section: 'room-amenities', icon: 'heating' },
  'fan':             { label: 'Fan',              section: 'room-amenities', icon: 'ac' },
  'fireplace':       { label: 'Fireplace',        section: 'room-amenities', icon: 'heating' },
  'iron':            { label: 'Iron',             section: 'room-amenities', icon: 'check' },
  'ironing-board':   { label: 'Ironing facilities', section: 'room-amenities', icon: 'check' },
  'carpeted':        { label: 'Carpeted',         section: 'room-amenities', icon: 'check' },
  'non-smoking':     { label: 'Non-smoking',      section: 'room-amenities', icon: 'smoking' },
  'smoking':         { label: 'Smoking allowed',  section: 'room-amenities', icon: 'smoking' },
};

// Regex fallbacks, evaluated in order before the room-amenities default.
const RULES: [RegExp, SectionId, string][] = [
  [/bathroom|shower|bath|bidet|toilet/i,        'bathroom',       'bath'],
  [/toiletr|towel|slipper|bathrobe|shampoo|soap/i, 'toiletries',  'toiletries'],
  [/coffee|\btea\b|kettle|minibar/i,            'food-drink',     'coffee'],
  [/kitchen|fridge|refrigerat|microwave|oven|stove|dishwash/i, 'kitchen', 'kitchen'],
  [/wi-?fi|internet|telephone|phone/i,          'internet-comms', 'wifi'],
  [/\btv\b|television|channels|streaming|dvd/i, 'media-tech',     'tv'],
  [/-view$|\bview\b|balcony|terrace|patio|wardrobe|closet|desk|curtain/i, 'room-layout', 'view'],
  [/safe|deposit-box/i,                         'general',        'safe'],
  [/air.?condition|heating|\bfan\b/i,           'room-amenities', 'ac'],
];

export function classifyRoomAmenity(slug: string): Classified {
  const key = slug.toLowerCase().trim();
  if (MAP[key]) return MAP[key];
  for (const [re, section, icon] of RULES) {
    if (re.test(key)) return { label: prettify(key), section, icon };
  }
  return { label: prettify(key), section: 'room-amenities', icon: 'check' };
}
```

- [ ] **Step 4: Run — expect PASS.** (Adjust the `icon` in the `-view` regex rule test if you rename keys; keep `label`/`section` as the test asserts.)

Run: `pnpm vitest run src/__tests__/roomAmenities.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotels/roomAmenities.ts src/__tests__/roomAmenities.test.ts
git commit -m "feat(hotels): ETG room-amenity slug classifier"
```

---

## Task 5: `roomContent.ts` — key facts, bed line, `buildRoomContent`

**Files:**
- Create: `src/lib/hotels/roomContent.ts`
- Test: `src/__tests__/roomContent.test.ts`

(`src/lib/hotels/roomContent.types.ts` was already created in Task 2, Step 0.)

- [ ] **Step 2: Write the failing test**

`src/__tests__/roomContent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRoomContent } from '@/lib/hotels/roomContent';
import type { EtgContent } from '@/lib/hotels/etgContent.types';

const etg = (o: Partial<EtgContent>): EtgContent => ({
  roomGroups: [], amenityGroups: [], metapolicy: null,
  metapolicyExtraInfo: null, importantInformation: null, ...o,
});

describe('buildRoomContent', () => {
  it('returns empty sections + [] gallery when no room-group matches', () => {
    const c = buildRoomContent('Mystery Room', etg({}));
    expect(c.sections).toEqual([]);
    expect(c.gallery).toEqual([]);
  });

  it('groups a matched room-group\u2019s slugs into ordered, non-empty sections', () => {
    const c = buildRoomContent('Standard Double Room', etg({
      roomGroups: [{
        name: 'Standard Double Room',
        images: ['img1', 'img2'],
        roomAmenities: ['private-bathroom', 'shower', 'tv', 'cable-tv', 'wi-fi', 'wardrobe', 'air-conditioning'],
        beddingType: 'double bed',
      }],
    }));
    expect(c.gallery).toEqual(['img1', 'img2']);
    expect(c.matchedRoomName).toBe('Standard Double Room');
    const ids = c.sections.map((s) => s.id);
    // canonical order: room-layout < bathroom < internet-comms < room-amenities < media-tech
    expect(ids).toEqual(['room-layout', 'bathroom', 'internet-comms', 'room-amenities', 'media-tech']);
    const bathroom = c.sections.find((s) => s.id === 'bathroom')!;
    expect(bathroom.items.map((i) => i.label)).toEqual(['Private bathroom', 'Shower']);
    expect(bathroom.scope).toBe('room');
  });

  it('deduplicates repeated labels within a section', () => {
    const c = buildRoomContent('Room A', etg({
      roomGroups: [{ name: 'Room A', images: [], roomAmenities: ['tv', 'television'] }],
    }));
    const media = c.sections.find((s) => s.id === 'media-tech')!;
    expect(media.items).toHaveLength(1);
  });

  it('builds key facts from bedding, bathroom type and metapolicy internet', () => {
    const c = buildRoomContent('Deluxe Room', etg({
      roomGroups: [{
        name: 'Deluxe Room', images: [], roomAmenities: ['air-conditioning', 'non-smoking'],
        beddingType: 'double bed', bathroomType: 'private',
      }],
      metapolicy: { internet: [{ inclusion: 'not_available' }] },
    }));
    const labels = c.keyFacts.map((f) => f.label);
    expect(labels).toContain('Non-smoking');
    expect(labels).toContain('Air conditioning');
    expect(labels).toContain('Private bathroom');
    expect(labels).toContain('Internet: contact hotel');
  });

  it('passes a TGX noise bed string through as the bed line', () => {
    const c = buildRoomContent('Twin Room (bed type is subject to availability)', etg({
      roomGroups: [{ name: 'Twin Room', images: [], roomAmenities: [] }],
    }));
    expect(c.bedLine).toBe('Bed type is subject to availability');
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

Run: `pnpm vitest run src/__tests__/roomContent.test.ts`

- [ ] **Step 4: Implement `buildRoomContent` + helpers**

`src/lib/hotels/roomContent.ts`:

```ts
import type { EtgContent, MetapolicyStruct, RoomGroupEntry } from './etgContent.types';
import { matchEtgRoomGroup } from './roomMatch';
import { classifyRoomAmenity } from './roomAmenities';
import {
  type SectionId, type DetailItem, type DetailSection, type RoomContent,
  SECTION_ORDER, SECTION_TITLES, ROOM_SCOPED,
} from './roomContent.types';

export * from './roomContent.types';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bed line: prefer ETG bedding_type, else a bed phrase or TGX noise string from the name. */
function buildBedLine(roomName: string, match: RoomGroupEntry | null): string | undefined {
  if (match?.beddingType) return cap(match.beddingType);
  const paren = /\(([^)]*bed[^)]*)\)/i.exec(roomName);
  if (paren) return cap(paren[1].trim());
  const phrase = /\b(\d+\s+)?(king|queen|double|twin|single|sofa)\s*beds?\b/i.exec(roomName);
  if (phrase) return cap(phrase[0].trim());
  return undefined;
}

function internetFact(mp: MetapolicyStruct | null): DetailItem | null {
  const e = mp?.internet?.[0];
  if (!e) return null;
  if (e.inclusion === 'included' || e.price === 0) return { label: 'Free Wi-Fi', icon: 'wifi' };
  if (e.inclusion === 'paid' && e.price) {
    return { label: `Wi-Fi: ${e.currency ?? ''} ${e.price}`.trim(), icon: 'wifi' };
  }
  return { label: 'Internet: contact hotel', icon: 'wifi' };
}

function buildKeyFacts(match: RoomGroupEntry | null, mp: MetapolicyStruct | null): DetailItem[] {
  const facts: DetailItem[] = [];
  const slugs = new Set(match?.roomAmenities ?? []);
  if (slugs.has('window') || slugs.has('has-window')) facts.push({ label: 'Has window(s)', icon: 'window' });
  if (slugs.has('non-smoking')) facts.push({ label: 'Non-smoking', icon: 'smoking' });
  else if (slugs.has('smoking')) facts.push({ label: 'Smoking allowed', icon: 'smoking' });
  const net = internetFact(mp);
  if (net) facts.push(net);
  if (slugs.has('air-conditioning')) facts.push({ label: 'Air conditioning', icon: 'ac' });
  if (match?.bathroomType === 'private' || slugs.has('private-bathroom')) {
    facts.push({ label: 'Private bathroom', icon: 'bath' });
  } else if (match?.bathroomType === 'shared' || slugs.has('shared-bathroom')) {
    facts.push({ label: 'Shared bathroom', icon: 'bath' });
  }
  return facts;
}

/** "Extra beds and cribs are unavailable for this room type" when metapolicy says so. */
export function buildBedsExtraSummary(mp: MetapolicyStruct | null): string | undefined {
  const cot = mp?.cot ?? [];
  const extra = mp?.extra_bed ?? [];
  const has = (arr: typeof cot) => arr.some((e) => e.inclusion && e.inclusion !== 'not_available');
  if (!has(cot) && !has(extra)) return 'Extra beds and cribs are unavailable for this room type';
  return undefined;
}

export function buildRoomContent(roomName: string, etg: EtgContent): RoomContent {
  const match = matchEtgRoomGroup(roomName, etg.roomGroups);

  const bySection = new Map<SectionId, DetailItem[]>();
  for (const slug of match?.roomAmenities ?? []) {
    const { label, section, icon } = classifyRoomAmenity(slug);
    const list = bySection.get(section) ?? [];
    if (!list.some((i) => i.label === label)) list.push({ label, icon });
    bySection.set(section, list);
  }

  const sections: DetailSection[] = SECTION_ORDER
    .filter((id) => ROOM_SCOPED.has(id) && (bySection.get(id)?.length ?? 0) > 0)
    .map((id) => ({ id, title: SECTION_TITLES[id], scope: 'room' as const, items: bySection.get(id)! }));

  return {
    gallery: match?.images ?? [],
    matchedRoomName: match?.name,
    keyFacts: buildKeyFacts(match, etg.metapolicy),
    bedLine: buildBedLine(roomName, match),
    bedsExtraSummary: buildBedsExtraSummary(etg.metapolicy),
    sections,
  };
}
```

- [ ] **Step 5: Run — expect PASS.**

Run: `pnpm vitest run src/__tests__/roomContent.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/hotels/roomContent.ts src/__tests__/roomContent.test.ts
git commit -m "feat(hotels): buildRoomContent — sections + key facts from ETG room-group"
```

---

## Task 6: Property policy sections + additional info

**Files:**
- Modify: `src/lib/hotels/roomContent.ts` (add `buildPolicySections`, `buildAdditionalInfo`)
- Test: `src/__tests__/roomPolicy.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/roomPolicy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPolicySections, buildAdditionalInfo } from '@/lib/hotels/roomContent';
import type { MetapolicyStruct } from '@/lib/hotels/etgContent.types';

describe('buildPolicySections', () => {
  it('is empty when metapolicy is null', () => {
    expect(buildPolicySections(null)).toEqual([]);
  });

  it('builds a child-policy section from children entries', () => {
    const mp: MetapolicyStruct = {
      children: [
        { age_start: 0, age_end: 5, inclusion: 'included', price: 0 },
        { age_start: 6, age_end: 12, inclusion: 'paid', price: 20, currency: 'EUR', price_unit: 'per_night' },
      ],
    };
    const [sec] = buildPolicySections(mp);
    expect(sec.id).toBe('child-policy');
    expect(sec.scope).toBe('property');
    expect(sec.items.map((i) => i.label)).toEqual([
      'Children 0\u20135 stay free',
      'Children 6\u201312: EUR 20 per night',
    ]);
  });

  it('builds a beds-extra section only when cot / extra bed is available', () => {
    const mp: MetapolicyStruct = {
      cot: [{ inclusion: 'paid', price: 15, currency: 'EUR', price_unit: 'per_night' }],
      extra_bed: [{ inclusion: 'not_available' }],
    };
    const secs = buildPolicySections(mp);
    const beds = secs.find((s) => s.id === 'beds-extra')!;
    expect(beds.items[0]).toEqual({ label: 'Cot: EUR 15 per night', icon: 'bed', note: undefined });
  });
});

describe('buildAdditionalInfo', () => {
  it('concatenates important info, extra info and phrased metapolicy', () => {
    const out = buildAdditionalInfo(
      'Front desk open 24 hours.',
      { pets: [{ inclusion: 'not_allowed' }], deposit: [{ inclusion: 'paid', price: 100, currency: 'USD' }] },
      'Photo ID required at check-in.',
    );
    expect(out).toContain('Front desk open 24 hours.');
    expect(out).toContain('Photo ID required at check-in.');
    expect(out).toContain('Pets are not allowed.');
    expect(out).toContain('A deposit of USD 100 may be required.');
  });

  it('returns an empty string when there is nothing to say', () => {
    expect(buildAdditionalInfo(null, null, null)).toBe('');
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/__tests__/roomPolicy.test.ts`

- [ ] **Step 3: Implement — append to `src/lib/hotels/roomContent.ts`**

```ts
import type { MetapolicyEntry } from './etgContent.types';

function money(e: MetapolicyEntry): string {
  const unit = e.price_unit ? ` ${e.price_unit.replace(/_/g, ' ')}` : '';
  return `${e.currency ?? ''} ${e.price ?? 0}${unit}`.trim();
}

export function buildPolicySections(mp: MetapolicyStruct | null): DetailSection[] {
  if (!mp) return [];
  const out: DetailSection[] = [];

  const childItems: DetailItem[] = (mp.children ?? []).map((e) => {
    const range = e.age_start != null && e.age_end != null ? `${e.age_start}\u2013${e.age_end}` : 'any age';
    if (e.inclusion === 'included' || e.price === 0) {
      return { label: `Children ${range} stay free`, icon: 'child' };
    }
    return { label: `Children ${range}: ${money(e)}`, icon: 'child' };
  });
  for (const e of mp.children_meal ?? []) {
    if (e.inclusion === 'included') childItems.push({ label: "Children's meals included", icon: 'child' });
  }
  if (childItems.length) {
    out.push({ id: 'child-policy', title: SECTION_TITLES['child-policy'], scope: 'property', items: childItems });
  }

  const bedItems: DetailItem[] = [];
  const avail = (e: MetapolicyEntry) => e.inclusion && e.inclusion !== 'not_available';
  for (const e of mp.cot ?? []) {
    if (!avail(e)) continue;
    bedItems.push({ label: (e.inclusion === 'included' || e.price === 0) ? 'Cot available free' : `Cot: ${money(e)}`, icon: 'bed', note: undefined });
  }
  for (const e of mp.extra_bed ?? []) {
    if (!avail(e)) continue;
    bedItems.push({ label: (e.inclusion === 'included' || e.price === 0) ? 'Extra bed available free' : `Extra bed: ${money(e)}`, icon: 'bed', note: undefined });
  }
  if (bedItems.length) {
    out.push({ id: 'beds-extra', title: SECTION_TITLES['beds-extra'], scope: 'property', items: bedItems });
  }

  return out;
}

export function buildAdditionalInfo(
  importantInfo: string | null,
  mp: MetapolicyStruct | null,
  extraInfo: string | null,
): string {
  const parts: string[] = [];
  if (importantInfo?.trim()) parts.push(importantInfo.trim());
  if (extraInfo?.trim()) parts.push(extraInfo.trim());

  const pet = mp?.pets?.[0];
  if (pet) {
    if (pet.inclusion === 'not_allowed') parts.push('Pets are not allowed.');
    else if (pet.inclusion === 'paid' && pet.price) parts.push(`Pets are allowed for ${money(pet)}.`);
    else if (pet.inclusion === 'included') parts.push('Pets are allowed free of charge.');
  }
  const dep = mp?.deposit?.[0];
  if (dep?.price) parts.push(`A deposit of ${dep.currency ?? ''} ${dep.price} may be required.`.replace(/\s+/g, ' '));
  const park = mp?.parking?.[0];
  if (park) {
    if (park.inclusion === 'included' || park.price === 0) parts.push('Free parking is available.');
    else if (park.price) parts.push(`Parking is available for ${money(park)}.`);
  }
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/__tests__/roomPolicy.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hotels/roomContent.ts src/__tests__/roomPolicy.test.ts
git commit -m "feat(hotels): property policy sections + additional-info builder"
```

---

## Task 7: `ensureEtgContent` — fetch + cache orchestrator

**Files:**
- Modify: `src/lib/hotels/etgContent.ts` (add `ensureEtgContent`, `EtgContentRow` type)
- Test: `src/__tests__/etgContent.ensure.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/etgContent.ensure.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { hotel_content: { update: vi.fn().mockResolvedValue({}) } },
}));

import { prisma } from '@/lib/prisma';
import { ensureEtgContent } from '@/lib/hotels/etgContent';

const FRESH = new Date();
const STALE = new Date(Date.now() - 40 * 24 * 3600 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ensureEtgContent', () => {
  it('uses the DB row without fetching when content is fresh', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const row = {
      hotel_id: 'H1', ratehawk_hid: 'slug_1', etg_content_seeded_at: FRESH,
      room_groups: [{ name: 'Std Room', images: [], roomAmenities: ['wi-fi'] }],
      amenity_groups: [], metapolicy_struct: null,
      metapolicy_extra_info: null, important_information: null,
    };
    const out = await ensureEtgContent('H1', row as any);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out?.roomGroups[0].name).toBe('Std Room');
  });

  it('returns null when there is no ratehawk_hid to fetch with', async () => {
    const row = { hotel_id: 'H1', ratehawk_hid: null, etg_content_seeded_at: null };
    expect(await ensureEtgContent('H1', row as any)).toBeNull();
  });

  it('fetches hotel/info when stale, then upserts and returns parsed content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {
        room_groups: [{ name: 'Deluxe', images: ['{size}/a.jpg'], room_amenities: ['tv'] }],
        amenity_groups: [{ group_name: 'General', amenities: ['Lift'] }],
        metapolicy_struct: { cot: [{ inclusion: 'paid', price: 10, currency: 'USD' }] },
        metapolicy_extra_info: 'ID required.',
      } }),
    }));
    const row = { hotel_id: 'H1', ratehawk_hid: 'slug_1', etg_content_seeded_at: STALE };
    const out = await ensureEtgContent('H1', row as any);
    expect(out?.roomGroups[0].images[0]).toBe('1024x768/a.jpg');
    expect(out?.amenityGroups[0].groupName).toBe('General');
    expect(prisma.hotel_content.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { hotel_id: 'H1' },
    }));
  });

  it('returns null (no throw) when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const row = { hotel_id: 'H1', ratehawk_hid: 'slug_1', etg_content_seeded_at: STALE };
    expect(await ensureEtgContent('H1', row as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/__tests__/etgContent.ensure.test.ts`

- [ ] **Step 3: Implement — append to `src/lib/hotels/etgContent.ts`**

Add these to the **top** of the file, with the existing imports:

```ts
import { prisma } from '@/lib/prisma';
import type { EtgContent } from './etgContent.types';
```

`parseRoomGroups` / `parseAmenityGroups` / `parseMetapolicy` are already defined in
this file (Task 2) — call them directly. Then append at the bottom:

```ts
const FRESH_MS = 30 * 24 * 3600 * 1000;

/** The subset of hotel_content ensureEtgContent reads. */
export interface EtgContentRow {
  hotel_id: string;
  ratehawk_hid: string | null;
  etg_content_seeded_at: Date | null;
  room_groups?: unknown;
  amenity_groups?: unknown;
  metapolicy_struct?: unknown;
  metapolicy_extra_info?: string | null;
  important_information?: string | null;
}

function etgToken(): string {
  const keyId  = process.env.ETG_KEY_ID  ?? '';
  const apiKey = process.env.ETG_API_KEY ?? '';
  return Buffer.from(`${keyId}:${apiKey}`).toString('base64');
}

function fromRow(row: EtgContentRow): EtgContent {
  return {
    roomGroups: parseRoomGroups(row.room_groups),
    amenityGroups: parseAmenityGroups(row.amenity_groups),
    metapolicy: parseMetapolicy(row.metapolicy_struct),
    metapolicyExtraInfo: row.metapolicy_extra_info ?? null,
    importantInformation: row.important_information ?? null,
  };
}

/**
 * Returns parsed ETG content for a hotel, fetching hotel/info and caching it to
 * hotel_content when the stored copy is missing or older than 30 days. Best
 * effort: any failure (no slug, network, non-2xx) returns null and the caller
 * falls back to the legacy modal body.
 */
export async function ensureEtgContent(
  hotelId: string,
  row: EtgContentRow,
): Promise<EtgContent | null> {
  const seededAt = row.etg_content_seeded_at?.getTime() ?? 0;
  const fresh = seededAt > 0 && Date.now() - seededAt < FRESH_MS;
  if (fresh && Array.isArray(row.room_groups)) return fromRow(row);

  if (!row.ratehawk_hid) return null;

  try {
    const res = await fetch('https://api.worldota.net/api/b2b/v3/hotel/info/', {
      method: 'POST',
      headers: { Authorization: `Basic ${etgToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.ratehawk_hid, language: 'en' }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const d = json?.data;
    if (!d) return null;

    const roomGroups   = parseRoomGroups(d.room_groups);
    const amenityGroups = parseAmenityGroups(d.amenity_groups);
    const metapolicy   = parseMetapolicy(d.metapolicy_struct);
    const metapolicyExtraInfo = typeof d.metapolicy_extra_info === 'string' ? d.metapolicy_extra_info : null;

    await prisma.hotel_content.update({
      where: { hotel_id: hotelId },
      data: {
        room_groups: roomGroups as any,
        amenity_groups: amenityGroups as any,
        metapolicy_struct: (d.metapolicy_struct ?? null) as any,
        metapolicy_extra_info: metapolicyExtraInfo,
        etg_content_seeded_at: new Date(),
        ...(typeof d.check_in_time === 'string' ? { check_in_time: d.check_in_time } : {}),
        ...(typeof d.check_out_time === 'string' ? { check_out_time: d.check_out_time } : {}),
      },
    }).catch(() => {});

    return {
      roomGroups, amenityGroups, metapolicy, metapolicyExtraInfo,
      importantInformation: row.important_information ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/__tests__/etgContent.ensure.test.ts`

- [ ] **Step 5: Run the whole hotels lib suite + types**

Run: `pnpm vitest run src/__tests__/etgContent.parse.test.ts src/__tests__/etgContent.ensure.test.ts src/__tests__/roomMatch.test.ts src/__tests__/roomAmenities.test.ts src/__tests__/roomContent.test.ts src/__tests__/roomPolicy.test.ts`
Then: `pnpm type-check`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hotels/etgContent.ts src/__tests__/etgContent.ensure.test.ts
git commit -m "feat(hotels): ensureEtgContent — on-demand hotel/info fetch + 30-day cache"
```

---

## Task 8: Wire into `getProperty` + response types

**Files:**
- Modify: `src/lib/hotels/property.ts` (extend `RoomOption`; add `PropertyContent` shape)
- Modify: `src/services/hotels.service.ts` (`getProperty`, ~line 203-223)
- Test: `src/__tests__/hotels.service.property.test.ts`

- [ ] **Step 1: Extend the types in `src/lib/hotels/property.ts`**

At the top, add:

```ts
import type { AmenityGroup, DetailSection, RoomContent } from './roomContent.types';
```

Add `content?: RoomContent;` to the `RoomOption` interface. Add:

```ts
export interface PropertyContentExtras {
  amenityGroups?: AmenityGroup[];
  roomPolicySections?: DetailSection[];
  additionalInfo?: string;
}
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/hotels.service.property.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/hotels/search', () => ({ runTgxSearch: vi.fn() }));
vi.mock('@/lib/hotels/travelgatex', () => ({
  quoteTgx: vi.fn(), bookTgx: vi.fn(), cancelTgx: vi.fn(), fetchAmenitiesByDestination: vi.fn(),
}));
vi.mock('@/lib/hotels/etgContent', () => ({ ensureEtgContent: vi.fn() }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));
vi.mock('@/lib/redis', () => ({ redis: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/repositories/hotels.repository', () => ({
  HotelsRepository: vi.fn(function (this: any) {
    this.findHotelContent     = vi.fn();
    this.findHotelReviews     = vi.fn();
    this.findHotelReviewItems = vi.fn();
  }),
}));
vi.mock('@/middleware/error.middleware', () => ({
  AppError: class extends Error { constructor(public status: number, m: string, public code: string) { super(m); } },
}));

import { runTgxSearch } from '@/lib/hotels/search';
import { ensureEtgContent } from '@/lib/hotels/etgContent';
import { HotelsService } from '@/services/hotels.service';

let svc: HotelsService;
beforeEach(() => {
  vi.clearAllMocks();
  svc = new HotelsService();
  (svc as any).repo.findHotelContent.mockResolvedValue({
    hotel_id: 'H1', name: 'Grand', ratehawk_hid: 'slug_1', etg_content_seeded_at: null,
    important_information: null, metapolicy_extra_info: null,
  });
  (svc as any).repo.findHotelReviews.mockResolvedValue(null);
  (svc as any).repo.findHotelReviewItems.mockResolvedValue([]);
  vi.mocked(runTgxSearch).mockResolvedValue({
    data: [{ roomTypes: [{
      offerId: 'o1', roomName: 'Standard Double Room', boardCode: 'BB',
      price: 200, currency: 'USD', refundable: true, refundableTag: 'REFUNDABLE',
    }] }],
  } as any);
});

describe('HotelsService.getProperty() — ETG content', () => {
  it('attaches room.content and property extras when ETG content resolves', async () => {
    vi.mocked(ensureEtgContent).mockResolvedValue({
      roomGroups: [{ name: 'Standard Double Room', images: ['i1'], roomAmenities: ['tv', 'wi-fi'] }],
      amenityGroups: [{ groupName: 'General', amenities: ['Lift'], nonFree: [] }],
      metapolicy: { children: [{ age_start: 0, age_end: 5, inclusion: 'included', price: 0 }] },
      metapolicyExtraInfo: 'ID required.', importantInformation: null,
    } as any);

    const out = await svc.getProperty('H1', { checkIn: '2026-09-10', checkOut: '2026-09-12' });

    expect(out.rooms[0].content?.gallery).toEqual(['i1']);
    expect(out.rooms[0].content?.sections.some((s: any) => s.id === 'media-tech')).toBe(true);
    expect((out.content as any).amenityGroups[0].groupName).toBe('General');
    expect((out.content as any).roomPolicySections[0].id).toBe('child-policy');
    expect((out.content as any).additionalInfo).toContain('ID required.');
  });

  it('leaves rooms unchanged when ETG content is null', async () => {
    vi.mocked(ensureEtgContent).mockResolvedValue(null);
    const out = await svc.getProperty('H1', { checkIn: '2026-09-10', checkOut: '2026-09-12' });
    expect(out.rooms[0].content).toBeUndefined();
    expect((out.content as any).amenityGroups).toBeUndefined();
  });

  it('does not fail the request when ensureEtgContent rejects', async () => {
    vi.mocked(ensureEtgContent).mockRejectedValue(new Error('boom'));
    const out = await svc.getProperty('H1', { checkIn: '2026-09-10', checkOut: '2026-09-12' });
    expect(out.rooms[0].content).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

Run: `pnpm vitest run src/__tests__/hotels.service.property.test.ts`

- [ ] **Step 4: Implement in `src/services/hotels.service.ts`**

Add imports near the other hotel-lib imports:

```ts
import { ensureEtgContent } from '@/lib/hotels/etgContent';
import { buildRoomContent, buildPolicySections, buildAdditionalInfo } from '@/lib/hotels/roomContent';
```

Add this helper above the class:

```ts
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}
```

Replace the body of `getProperty` (currently lines ~203-223) with:

```ts
async getProperty(hotelId: string, stay: { checkIn: string; checkOut: string; adults?: number; children?: number }) {
  const [content, reviews, reviewItems, tgxResult] = await Promise.all([
    this.repo.findHotelContent(hotelId),
    this.repo.findHotelReviews(hotelId),
    this.repo.findHotelReviewItems(hotelId, 20),
    searchHotels({
      hotelCode: hotelId,
      checkin:   stay.checkIn,
      checkout:  stay.checkOut,
      adults:    stay.adults ?? 2,
      children:  stay.children ?? 0,
      currency:  'USD',
      guest_nationality: 'US',
    }).catch(() => null),
  ]);
  if (!content) throw new AppError(404, 'Property not found', 'NOT_FOUND');

  const rawTypes = tgxResult?.data?.[0]?.roomTypes ?? [];
  let rooms = groupByRoomName(rawTypes);

  const etg = await withTimeout(ensureEtgContent(hotelId, content as any), 8_000);
  if (etg) {
    rooms = rooms.map((room) => ({ ...room, content: buildRoomContent(room.name, etg) }));
  }

  const outContent = etg
    ? {
        ...content,
        amenityGroups:      etg.amenityGroups,
        roomPolicySections: buildPolicySections(etg.metapolicy),
        additionalInfo:     buildAdditionalInfo(
          (content as any).important_information ?? null,
          etg.metapolicy,
          etg.metapolicyExtraInfo,
        ),
      }
    : content;

  return { content: outContent, reviews, reviewItems, rooms };
}
```

- [ ] **Step 5: Run the property test + full API suite + types**

Run: `pnpm vitest run src/__tests__/hotels.service.property.test.ts`
Then: `pnpm test`
Then: `pnpm type-check`
Expected: all PASS. (If `hotels.service.test.ts` mock lacks `ensureEtgContent`, add `vi.mock('@/lib/hotels/etgContent', () => ({ ensureEtgContent: vi.fn().mockResolvedValue(null) }))` to that file.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/hotels/property.ts src/services/hotels.service.ts src/__tests__/hotels.service.property.test.ts src/__tests__/hotels.service.test.ts
git commit -m "feat(hotels): getProperty attaches ETG room content + property policy sections"
```

---

## Task 9: Manual smoke against a real hotel

- [ ] **Step 1: Start the API**

Run: `pnpm dev`

- [ ] **Step 2: Hit the property endpoint for a hotel with a known `ratehawk_hid`**

Find one: `pnpm prisma studio` → `hotel_content` → filter `ratehawk_hid` not null, copy a `hotel_id`.

Run: `curl "http://localhost:4000/api/hotels/property/<hotel_id>?checkIn=2026-10-10&checkOut=2026-10-12" | jq '{rooms: (.rooms[0] | {name, content: (.content | {gallery: (.gallery|length), keyFacts, sections: [.sections[] | {id, count: (.items|length)}]})}), policy: (.content.roomPolicySections // []), addl: (.content.additionalInfo // "" | .[0:120])}'`

Expected: `content` present, `sections` an array of `{id, count}`, `keyFacts` populated. If `content` is null on the first call, run it again (cold-cache seeds on the first hit).

- [ ] **Step 3: Note anything off** (wrong section for a slug, empty everything) in a scratch file; tune `roomAmenities.ts` `MAP`/`RULES` and re-run its test. Commit fixes as `fix(hotels): tune room-amenity classification`.

---

# Phase 2 — Frontend (`cheapestgo-app-v2`)

All paths in Phase 2 are relative to `c:\Users\USER\Documents\GitHub\cheapestgo-app-v2`.

## Task 10: Mirror types

**Files:**
- Modify: `src/features/hotels/types/property.types.ts`

- [ ] **Step 1: Add the shared types**

Append to `src/features/hotels/types/property.types.ts`:

```ts
export type SectionId =
  | 'room-layout' | 'toiletries' | 'food-drink' | 'bathroom' | 'internet-comms'
  | 'room-amenities' | 'media-tech' | 'kitchen' | 'general' | 'child-policy' | 'beds-extra';

export interface DetailItem { label: string; icon?: string; note?: string }

export interface DetailSection {
  id: SectionId;
  title: string;
  scope: 'room' | 'property';
  items: DetailItem[];
}

export interface AmenityGroup { groupName: string; amenities: string[]; nonFree: string[] }

export interface RoomContent {
  gallery: string[];
  matchedRoomName?: string;
  keyFacts: DetailItem[];
  bedLine?: string;
  bedsExtraSummary?: string;
  sections: DetailSection[];
}
```

Add `content?: RoomContent;` to `interface RoomOption`.

In `interface HotelContent`, add:

```ts
  amenityGroups?: AmenityGroup[];
  roomPolicySections?: DetailSection[];
  additionalInfo?: string;
```

Also add the same three optional fields to the local `HotelContent` interface in
`src/app/[locale]/property/[id]/page.tsx` (lines ~23-46).

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/hotels/types/property.types.ts "src/app/[locale]/property/[id]/page.tsx"
git commit -m "feat(hotels): mirror RoomContent / DetailSection types on the frontend"
```

---

## Task 11: Extract the shared `Lightbox`

The modal's gallery reuses the lightbox currently inline in the property page.

**Files:**
- Create: `src/features/hotels/components/lightbox.tsx`
- Modify: `src/app/[locale]/property/[id]/page.tsx` (remove inline `Lightbox`, import it)

- [ ] **Step 1: Create `src/features/hotels/components/lightbox.tsx`**

This is a verbatim move of the `Lightbox` function currently at
`src/app/[locale]/property/[id]/page.tsx:259-335` — same body, now `export`ed with
its own imports:

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}
      >
        <X size={18} />
      </button>

      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
        {idx + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          style={{ position: 'absolute', left: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx]}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '88vw', maxHeight: '84vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,.7)', userSelect: 'none' }}
      />

      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          style={{ position: 'absolute', right: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronRight size={22} />
        </button>
      )}

      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {images.map((_, i) => (
            <div
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#fff' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .2s' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Then **delete** the `Lightbox` function (and its now-unused local imports if any) from `page.tsx`.

- [ ] **Step 2: Import it back in `page.tsx`**

Add near the other feature imports:

```ts
import { Lightbox } from '@/features/hotels/components/lightbox';
```

- [ ] **Step 3: Type-check + run the property/search tests**

Run: `pnpm type-check`
Run: `pnpm vitest run src/features/hotels`
Expected: PASS (no behaviour change).

- [ ] **Step 4: Commit**

```bash
git add src/features/hotels/components/lightbox.tsx "src/app/[locale]/property/[id]/page.tsx"
git commit -m "refactor(hotels): extract shared Lightbox component"
```

---

## Task 12: `room-content.tsx` — section icon map + renderer pieces

**Files:**
- Create: `src/features/hotels/components/room-content.tsx`
- Test: `src/features/hotels/__tests__/room-content.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/hotels/__tests__/room-content.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailSectionGrid, KeyFactsRow } from '@/features/hotels/components/room-content';
import type { DetailSection, DetailItem } from '@/features/hotels/types/property.types';

const palette = { heading: '', feature: 'text-x', columnHeading: '', columnDot: '', empty: '' } as any;

describe('DetailSectionGrid', () => {
  it('renders one header per section and its items', () => {
    const sections: DetailSection[] = [
      { id: 'bathroom', title: 'Bathroom', scope: 'room', items: [{ label: 'Shower' }, { label: 'Towels' }] },
      { id: 'kitchen', title: 'Kitchen facilities', scope: 'room', items: [{ label: 'Refrigerator' }] },
    ];
    render(<DetailSectionGrid sections={sections} palette={palette} />);
    expect(screen.getByText('Bathroom')).toBeInTheDocument();
    expect(screen.getByText('Kitchen facilities')).toBeInTheDocument();
    expect(screen.getByText('Shower')).toBeInTheDocument();
    expect(screen.getByText('Refrigerator')).toBeInTheDocument();
  });

  it('renders nothing when there are no sections', () => {
    const { container } = render(<DetailSectionGrid sections={[]} palette={palette} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a note beside an item when present', () => {
    const sections: DetailSection[] = [
      { id: 'beds-extra', title: 'Cribs and extra beds', scope: 'property',
        items: [{ label: 'Extra bed', note: 'EUR 25 per night' }] },
    ];
    render(<DetailSectionGrid sections={sections} palette={palette} />);
    expect(screen.getByText('EUR 25 per night')).toBeInTheDocument();
  });
});

describe('KeyFactsRow', () => {
  it('renders each fact label, no header', () => {
    const facts: DetailItem[] = [{ label: 'Non-smoking' }, { label: '25 m\u00b2' }];
    render(<KeyFactsRow facts={facts} palette={palette} />);
    expect(screen.getByText('Non-smoking')).toBeInTheDocument();
    expect(screen.getByText('25 m\u00b2')).toBeInTheDocument();
  });
  it('renders nothing for an empty list', () => {
    const { container } = render(<KeyFactsRow facts={[]} palette={palette} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/hotels/__tests__/room-content.test.tsx`

- [ ] **Step 3: Implement**

`src/features/hotels/components/room-content.tsx`:

```tsx
'use client';

import React from 'react';
import {
  AirVent, Baby, Bath, Bed, Building2, Check, Coffee, Lock, PanelTop, Phone,
  Refrigerator, Shirt, Tv, UtensilsCrossed, Wifi, Wind, Maximize2, Cigarette,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { DetailItem, DetailSection } from '@/features/hotels/types/property.types';

const SECTION_ICONS: Record<string, LucideIcon> = {
  bed: Bed, bath: Bath, shower: Bath, toiletries: Check, wifi: Wifi, phone: Phone,
  tv: Tv, kitchen: UtensilsCrossed, fridge: Refrigerator, ac: AirVent, heating: Wind,
  safe: Lock, desk: PanelTop, wardrobe: Shirt, coffee: Coffee, child: Baby,
  size: Maximize2, window: PanelTop, smoking: Cigarette, view: Building2, check: Check,
};

function iconFor(key?: string): LucideIcon {
  return (key && SECTION_ICONS[key]) || Check;
}

interface PaletteLike {
  feature: string;
  columnHeading?: string;
  empty?: string;
}

export function KeyFactsRow({ facts, palette }: { facts: DetailItem[]; palette: PaletteLike }) {
  if (!facts.length) return null;
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
      {facts.map((f, i) => {
        const Icon = iconFor(f.icon);
        return (
          <li key={`${f.label}-${i}`} className={cn('flex items-center gap-2 text-[15px]', palette.feature)}>
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="min-w-0">{f.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DetailSectionGrid({ sections, palette }: { sections: DetailSection[]; palette: PaletteLike }) {
  if (!sections.length) return null;
  return (
    <div className="grid gap-x-8 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {sections.map((section) => (
        <div key={section.id} className="min-w-0">
          <h4 className={cn('text-[15px] font-semibold', palette.columnHeading)}>{section.title}</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {section.items.map((item, i) => {
              const Icon = iconFor(item.icon);
              return (
                <li key={`${item.label}-${i}`} className={cn('flex items-start gap-2 text-[14px]', palette.feature)}>
                  <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    {item.label}
                    {item.note && <span className={cn('ml-1', palette.empty)}>— {item.note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/features/hotels/__tests__/room-content.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/components/room-content.tsx src/features/hotels/__tests__/room-content.test.tsx
git commit -m "feat(hotels): DetailSectionGrid + KeyFactsRow modal pieces"
```

---

## Task 13: Rebuild `RoomDetailDialog`

**Files:**
- Modify: `src/features/hotels/components/room-selection.tsx` (`RoomDetailDialog`, ~line 469-592; `RateCard` gains `content`; `cards` useMemo passes it through)
- Modify: `src/features/hotels/__tests__/room-selection.test.tsx`

- [ ] **Step 1: Write the failing tests — append to `room-selection.test.tsx`**

```tsx
import type { RoomContent } from '@/features/hotels/types/property.types';

const roomWithContent = (content: RoomContent) => makeRoom({
  // reuse the default rate
  amenities: [],
});

describe('RoomSelection — categorised modal', () => {
  const content: RoomContent = {
    gallery: [],
    keyFacts: [{ label: 'Non-smoking' }, { label: 'Private bathroom' }],
    bedLine: 'Double bed',
    bedsExtraSummary: 'Extra beds and cribs are unavailable for this room type',
    sections: [
      { id: 'bathroom', title: 'Bathroom', scope: 'room', items: [{ label: 'Shower' }] },
      { id: 'media-tech', title: 'Media and technology', scope: 'room', items: [{ label: 'Cable channels' }] },
    ],
  };

  it('renders per-category headers and the key-facts / bed lines', () => {
    const room = makeRoom();
    room.content = content;
    render(<RoomSelection {...baseProps} rooms={[room]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Bathroom')).toBeInTheDocument();
    expect(within(dialog).getByText('Media and technology')).toBeInTheDocument();
    expect(within(dialog).getByText('Shower')).toBeInTheDocument();
    expect(within(dialog).getByText('Double bed')).toBeInTheDocument();
    expect(within(dialog).getByText('Extra beds and cribs are unavailable for this room type')).toBeInTheDocument();
  });

  it('falls back to the legacy amenity list when content is absent', () => {
    render(<RoomSelection {...baseProps} rooms={[makeRoom({ amenities: ['Sea view', 'Balcony'] })]} hotelAmenities={[]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sea view')).toBeInTheDocument();
    expect(within(dialog).queryByText('Bathroom')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/hotels/__tests__/room-selection.test.tsx`

- [ ] **Step 3: Thread `content` through the card model**

In `room-selection.tsx`:

- Add `content?: RoomContent;` to the `RateCard` interface (~line 450).
- Import: `import type { RoomContent } from '@/features/hotels/types/property.types';`
  and `import { DetailSectionGrid, KeyFactsRow } from './room-content';`
- In the `cards` useMemo (~line 713), add `content: room.content,` to the returned object.

- [ ] **Step 4: Rewrite `RoomDetailDialog`'s body**

Widen the panel: change `max-w-lg` → `max-w-4xl` (~line 499).

After the pills block (`</div>` closing `mt-3 flex flex-wrap gap-2`, ~line 515), and
**replacing** the current "Room" section (`card.allFeatures.length > 0 && (...)`,
~lines 517-526), insert:

```tsx
{card.content ? (
  <>
    {card.content.bedLine && (
      <p className={cn('mt-4 flex items-center gap-2 text-[15px]', palette.feature)}>
        <Bed size={17} strokeWidth={1.75} className="shrink-0" />
        {card.content.bedLine}
      </p>
    )}
    {card.content.bedsExtraSummary && (
      <p className={cn('mt-1 text-[13px]', palette.empty)}>{card.content.bedsExtraSummary}</p>
    )}

    {card.content.gallery.length > 0 && (
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {card.content.gallery.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            onClick={() => setLightboxStart(i)}
            className="h-28 w-40 shrink-0 cursor-pointer rounded-lg object-cover"
          />
        ))}
      </div>
    )}
    {card.content.gallery.length === 0 && galleryFallback && (
      <div className="mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={galleryFallback} alt="" className="h-40 w-full rounded-lg object-cover" />
        <p className={cn('mt-1 text-[12px]', palette.empty)}>Photo of the property</p>
      </div>
    )}

    {card.content.keyFacts.length > 0 && (
      <section className="mt-5">
        <KeyFactsRow facts={card.content.keyFacts} palette={palette} />
      </section>
    )}

    {(card.content.sections.length > 0 || (propertySections?.length ?? 0) > 0) && (
      <section className="mt-6">
        <DetailSectionGrid
          sections={[...card.content.sections, ...(propertySections ?? [])]}
          palette={palette}
        />
      </section>
    )}
  </>
) : (
  card.allFeatures.length > 0 && (
    <section className="mt-6">
      <p className={sectionLabel}>Room</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {card.allFeatures.map((feature, i) => (
          <FeatureRow key={`${feature.label}-${i}`} feature={feature} palette={palette} />
        ))}
      </ul>
    </section>
  )
)}
```

Add the `additionalInfo` block just before the Price `<section>` (~line 558):

```tsx
{additionalInfo && (
  <section className="mt-6">
    <p className={sectionLabel}>Additional information</p>
    <p className={cn('mt-2 whitespace-pre-line text-[14px]', palette.feature)}>{additionalInfo}</p>
  </section>
)}
```

- [ ] **Step 5: Add the new props + local state to `RoomDetailDialog`**

Signature (~line 469) — add `propertySections`, `additionalInfo`, `galleryFallback`:

```tsx
function RoomDetailDialog({
  card, palette, currency, nights, selected, onClose, onSelect,
  propertySections, additionalInfo, galleryFallback,
}: {
  card: RateCard; palette: Palette; currency: string; nights?: number | null;
  selected: boolean; onClose: () => void; onSelect: (offer: SelectedOffer) => void;
  propertySections?: DetailSection[];
  additionalInfo?: string;
  galleryFallback?: string | null;
}) {
  const [lightboxStart, setLightboxStart] = useState<number | null>(null);
  // ...existing useEffect / consts...
```

Before the closing `</div>,` of the portal (just before `document.body`), add:

```tsx
{lightboxStart !== null && card.content && (
  <Lightbox
    images={card.content.gallery}
    startIndex={lightboxStart}
    onClose={() => setLightboxStart(null)}
  />
)}
```

Import at the top of `room-selection.tsx`:
`import { Lightbox } from './lightbox';`
`import type { DetailSection } from '@/features/hotels/types/property.types';`

- [ ] **Step 6: Pass the new props from `RoomRateCard` → `RoomDetailDialog`**

`RoomRateCard` needs `propertySections`, `additionalInfo`, `galleryFallback` props
too — add them to its interface (~line 596) and forward them to `<RoomDetailDialog>`
(~line 681). Then in `RoomSelection` (the exported component), accept:

```tsx
propertySections?: DetailSection[];
additionalInfo?: string;
```

on `RoomSelectionProps`, and pass `propertySections={propertySections}`,
`additionalInfo={additionalInfo}`, `galleryFallback={image}` to each `<RoomRateCard>`
(~line 775).

- [ ] **Step 7: Run — expect PASS.**

Run: `pnpm vitest run src/features/hotels/__tests__/room-selection.test.tsx`
Then: `pnpm vitest run src/features/hotels`
Then: `pnpm type-check`

- [ ] **Step 8: Commit**

```bash
git add src/features/hotels/components/room-selection.tsx src/features/hotels/__tests__/room-selection.test.tsx
git commit -m "feat(hotels): categorised room-detail modal"
```

---

## Task 14: Wire the property page

**Files:**
- Modify: `src/app/[locale]/property/[id]/page.tsx` (pass `content.roomPolicySections` + `content.additionalInfo` into `<RoomSelection>`)

- [ ] **Step 1: Pass the new props**

In `page.tsx` where `<RoomSelection ... />` is rendered (~line 741), add:

```tsx
propertySections={content.roomPolicySections}
additionalInfo={content.additionalInfo}
```

- [ ] **Step 2: Type-check + run**

Run: `pnpm type-check`
Run: `pnpm vitest run src/features/hotels`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/property/[id]/page.tsx"
git commit -m "feat(hotels): feed property policy sections + additional info to RoomSelection"
```

---

## Task 15: `PropertyDescription` grouped amenities

**Files:**
- Modify: `src/features/hotels/components/property-description.tsx`
- Modify: `src/app/[locale]/property/[id]/page.tsx` (pass `amenityGroups`)
- Test: `src/features/hotels/__tests__/property-description.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

`src/features/hotels/__tests__/property-description.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertyDescription } from '@/features/hotels/components/property-description';

vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('PropertyDescription — grouped amenities', () => {
  it('renders a labelled group per amenityGroups entry when provided', () => {
    render(
      <PropertyDescription
        tone="dark"
        amenities={['Free WiFi']}
        amenityGroups={[
          { groupName: 'Internet', amenities: ['Free WiFi in all rooms'], nonFree: [] },
          { groupName: 'Parking',  amenities: ['Free private parking'],   nonFree: [] },
        ]}
      />,
    );
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText('Free WiFi in all rooms')).toBeInTheDocument();
  });

  it('falls back to the flat list when amenityGroups is absent', () => {
    render(<PropertyDescription tone="dark" amenities={['24 hour reception', 'Elevator']} />);
    expect(screen.getByText('24 hour reception')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/hotels/__tests__/property-description.test.tsx`

- [ ] **Step 3: Implement**

In `property-description.tsx`:

Add the import and the prop:

```ts
import type { AmenityGroup } from '@/features/hotels/types/property.types';
// in PropertyDescriptionProps:
amenityGroups?: AmenityGroup[];
```

Destructure `amenityGroups` in the component signature. After the existing
`const { facilities, policies } = useMemo(...)`, add:

```tsx
const amenityChipGroups = useMemo(
  () =>
    amenityGroups?.length
      ? amenityGroups.map((g) => ({ label: g.groupName, items: g.amenities })).filter((g) => g.items.length)
      : facilities.length
        ? [{ label: 'Amenities', items: facilities }]
        : [],
  [amenityGroups, facilities],
);
```

Replace the `hasChips` grid block. Currently it renders one `<ChipGroup label="Amenities">`
and one `<ChipGroup label="Rules & Policies">`. Change the left side to map
`amenityChipGroups`:

```tsx
{(amenityChipGroups.length > 0 || policies.length > 0) && (
  <div className={cn('grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2', (hasTimes || hasPrice || hasRating) && 'mt-6')}>
    <div className="flex min-w-0 flex-col gap-6">
      {amenityChipGroups.map((g) => (
        <ChipGroup
          key={g.label}
          label={g.label}
          items={g.items}
          moreLabel="View more"
          lessLabel="View less"
          palette={palette}
          reduceMotion={reduceMotion}
          className="min-w-0"
        />
      ))}
    </div>
    <ChipGroup
      label="Rules & Policies"
      items={policies}
      moreLabel="View more"
      lessLabel="View less"
      palette={palette}
      reduceMotion={reduceMotion}
      className="min-w-0"
    />
  </div>
)}
```

Update the early-return guard and `hasChips` references to use
`amenityChipGroups.length > 0 || policies.length > 0`.

- [ ] **Step 4: Pass the prop from `page.tsx`**

At `<PropertyDescription ... />` (~line 711) add `amenityGroups={content.amenityGroups}`.

- [ ] **Step 5: Run — expect PASS + type-check.**

Run: `pnpm vitest run src/features/hotels`
Run: `pnpm type-check`

- [ ] **Step 6: Commit**

```bash
git add src/features/hotels/components/property-description.tsx "src/app/[locale]/property/[id]/page.tsx" src/features/hotels/__tests__/property-description.test.tsx
git commit -m "feat(hotels): grouped hotel amenities in PropertyDescription"
```

---

## Task 16: Full-stack manual verification

- [ ] **Step 1: Both servers up** — API `pnpm dev` (in api repo), frontend `pnpm dev` (in app repo).

- [ ] **Step 2: Open a property page** for a hotel with a `ratehawk_hid`:
  `http://localhost:3001/property/<hotel_id>?checkIn=2026-10-10&checkOut=2026-10-12`

- [ ] **Step 3: Open a room's "View more" modal.** Confirm against the reference images:
  - bed line + "Extra beds and cribs…" sentence under the title
  - key-facts block (no header)
  - one header per category, items beneath, empty categories absent
  - a photo strip if the room matched (or "Photo of the property")
  - "Additional information" block at the bottom
  - Meal plan / Cancellation policy / Price / Select Room still present and working

- [ ] **Step 4: Open a room whose name won't match any ETG group** (or a hotel with
  no `ratehawk_hid`) — confirm the modal shows the legacy compact list and nothing
  is broken.

- [ ] **Step 5: `git log --oneline` in both repos** — confirm the task commits are all present.

---

## Self-review notes

- **Spec coverage:** pipeline (Tasks 1,7,8), room matching (3), classifier (4),
  key facts + bed line (5), room sections (5), policy sections + additional info
  (6), modal redesign (12,13), fallbacks (13 step 1 test), PropertyDescription
  upgrade (15), tests throughout, manual smoke (9,16). ✔
- **`serp_filters`** intentionally dropped (spec updated). Kitchen detection is
  slug-based in `roomAmenities.ts`.
- **Type consistency:** `SectionId`, `DetailSection`, `DetailItem`, `RoomContent`,
  `AmenityGroup` are defined once in `roomContent.types.ts` (API) and mirrored
  verbatim in `property.types.ts` (FE). `buildRoomContent` / `buildPolicySections`
  / `buildAdditionalInfo` names are stable across Tasks 5, 6, 8.
- **`ensureEtgContent(hotelId, row)`** two-arg signature is consistent in Tasks 7
  and 8.
