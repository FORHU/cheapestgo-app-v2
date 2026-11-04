# Golf Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers browse curated golf courses at `/golf` and `/golf/[slug]` and ask about tee times in the support chat; admins curate the courses at `/admin/golf`.

**Architecture:** api-v2 gets a v2-authored `golf_courses` migration and a Route → Controller → Service → Repository stack (public `/golf/courses`, admin `/admin/golf/courses`). app-v2 gets a `features/golf` folder (types, API client, card, list and course views), an admin screen, a small store that lets a page ask the support widget to open, and two entry points (Journey card, search-bar tab).

**Tech Stack:** api-v2: Express 4, Prisma 6 `$queryRaw`, zod 3.25, vitest 4. app-v2: Next 15 app router, next-intl, zustand 5, Tailwind v4, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-golf-catalogue-design.md` (this repo).

**Repos and branches.** `API` = `C:\Users\USER\Documents\GitHub\cheapestgo-api-v2-nearby`, `APP` = `C:\Users\USER\Documents\GitHub\cheapestgo-app-v2-nearby`. Both on `feat/golf-catalogue`, cut from `feat/flight-booking-money-safety` (APP's already exists). Code blocks are tagged `title="api:<path>"` / `title="app:<path>"` with the file they create.

**Safety.** API's `.env` points at `127.0.0.1:5434/cheapestgo_v2` (local v2 database). Re-check before Task 1 Step 3; never apply anything to another host.

---

## File map

**API — create:** `db/migrations/20261104000001_golf_courses.sql`, `src/lib/golf/courseInput.ts`, `src/repositories/golf.repository.ts`, `src/services/golf.service.ts`, `src/controllers/golf.controller.ts`, `src/routes/golf.route.ts`, `src/routes/admin-golf.route.ts`, tests `src/__tests__/golfCourseInput.test.ts`, `golf.repository.test.ts`, `golf.service.test.ts`, `golf.routes.test.ts`.
**API — modify:** `src/routes/index.ts` (mount), `prisma/schema.prisma` (model), `CONTEXT.md` (glossary).

**APP — create:** `src/features/golf/types.ts`, `lib/slugify.ts`, `api/golf.api.ts`, `components/{golf-course-card,golf-list-view,golf-course-view,ask-tee-times-button}.tsx`, tests in `src/features/golf/__tests__/`; `src/features/support/lib/supportWidget.store.ts`; `src/features/admin/components/{golf-course-form,golf-courses-view}.tsx` + `golf-course-form.test.tsx`; pages `src/app/[locale]/golf/page.tsx`, `src/app/[locale]/golf/[slug]/page.tsx`, `src/app/admin/(dashboard)/golf/page.tsx`.
**APP — modify:** `src/features/support/components/SupportWidget.tsx` (+ test), `src/features/admin/components/admin-sidebar.tsx`, `src/app/admin/layout.tsx`, `src/features/landing/journey/Journey.tsx` (+ test), `src/features/search/components/immersive-search-bar.tsx` (+ test), `src/locales/{en,ko,ja,zh}.json`, `src/locales/NEEDS_NATIVE_REVIEW.md`.

---

## Task 0: Baselines

- [ ] **Step 1: Branch API**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && git status --short && git switch -c feat/golf-catalogue
```
Expected: clean tree, `Switched to a new branch 'feat/golf-catalogue'`.

- [ ] **Step 2: Record baselines** (so later failures can be told apart from pre-existing ones)

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && npx vitest run 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | tail -3
cd /c/Users/USER/Documents/GitHub/cheapestgo-app-v2-nearby && npx vitest run 2>&1 | tail -8 && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Write the four results into the scratchpad; Task 14 compares against them.

---

## Task 1: Migration and Prisma model (API)

**Files:** Create `db/migrations/20261104000001_golf_courses.sql`; modify `prisma/schema.prisma`.

- [ ] **Step 1: Write the migration**

```sql title="api:db/migrations/20261104000001_golf_courses.sql"
-- migrate:up
-- The golf courses CheapestGo can arrange play at (CONTEXT.md, "Golf Course").
--
-- There is no golf supplier behind this table. The team curates it by hand in the admin, and a
-- course reaches the storefront only once it is published. Nothing here is bookable yet: the
-- course page's one action is the support chat, and tee times arrive in a later slice
-- (app-v2 docs/superpowers/specs/2026-11-04-golf-catalogue-design.md).
--
-- `green_fee_from` is a guide "from" price per player in the course's own `currency`. The API
-- restates it in the viewer's Display Currency; it is never a quote and nothing is charged from it.
--
-- The rules are v1's (cheapest-go-app, feat/golf-courses), restated here for v2 rather than copied:
-- v1's migration numbers already collide with v2's, and dbmate keys on version alone.
--
-- `status` is text with a CHECK rather than an enum, so a new state is a constraint swap.
-- `amenities` is a closed list enforced by the API's zod schema, not here, so adding one is a code
-- change rather than a migration.
--
-- Additive only, and re-running it by hand is harmless.

CREATE TABLE IF NOT EXISTS golf_courses (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text        NOT NULL,
    name            text        NOT NULL,
    country         text        NOT NULL,
    city            text        NOT NULL,
    address         text,
    description     text        NOT NULL DEFAULT '',
    holes           integer     NOT NULL,
    par             integer,
    green_fee_from  numeric(10,2),
    currency        char(3)     NOT NULL DEFAULT 'USD',
    image_urls      text[]      NOT NULL DEFAULT '{}',
    amenities       text[]      NOT NULL DEFAULT '{}',
    status          text        NOT NULL DEFAULT 'draft',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT golf_courses_slug_key          UNIQUE (slug),
    CONSTRAINT golf_courses_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT golf_courses_holes_check       CHECK (holes IN (9, 18, 27, 36)),
    CONSTRAINT golf_courses_par_check         CHECK (par IS NULL OR par BETWEEN 27 AND 144),
    CONSTRAINT golf_courses_green_fee_check   CHECK (green_fee_from IS NULL OR green_fee_from >= 0),
    CONSTRAINT golf_courses_currency_check    CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT golf_courses_status_check      CHECK (status IN ('draft', 'published'))
);

-- The storefront's list: published courses, optionally in one country.
CREATE INDEX IF NOT EXISTS idx_golf_courses_status_country ON golf_courses (status, country);

-- migrate:down
DROP TABLE IF EXISTS golf_courses;
```

- [ ] **Step 2: Confirm the target is the local v2 database**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && grep -E '^DATABASE_URL' .env | sed -E 's#^DATABASE_URL=["]?[a-z]+://[^@]*@([^/?"]+)/([^?"]+).*#host=\1 db=\2#'
```
Expected: `host=127.0.0.1:5434 db=cheapestgo_v2`. Stop if it is anything else.

- [ ] **Step 3: Apply the up section by hand and record it** (dbmate is not installed; this is the repo's documented practice for its migrations)

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby
sed -n '/^-- migrate:up/,/^-- migrate:down/p' db/migrations/20261104000001_golf_courses.sql \
  | docker exec -i cheapestgo-api-v2-postgres-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d cheapestgo_v2'
docker exec cheapestgo-api-v2-postgres-1 sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d cheapestgo_v2 -c "INSERT INTO schema_migrations (version) VALUES ('"'"'20261104000001'"'"') ON CONFLICT DO NOTHING" -c "\d golf_courses"'
```
Expected: `CREATE TABLE`, `CREATE INDEX`, `INSERT 0 1`, and the table description listing all 16 columns and 7 constraints.

- [ ] **Step 4: Bring `schema.prisma` level with the database**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && npx prisma db pull && git diff --stat prisma/schema.prisma
```
If the diff touches anything besides adding `model golf_courses`, the file had drifted: `git checkout prisma/schema.prisma` and add only this block after the last model, then `npx prisma validate`:

```prisma
/// This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
model golf_courses {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug           String   @unique(map: "golf_courses_slug_key")
  name           String
  country        String
  city           String
  address        String?
  description    String   @default("")
  holes          Int
  par            Int?
  green_fee_from Decimal? @db.Decimal(10, 2)
  currency       String   @default("USD") @db.Char(3)
  image_urls     String[] @default([])
  amenities      String[] @default([])
  status         String   @default("draft")
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([status, country], map: "idx_golf_courses_status_country")
}
```

- [ ] **Step 5: Regenerate the client and commit**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && npx prisma generate
git add db/migrations/20261104000001_golf_courses.sql prisma/schema.prisma
git commit -m "feat(golf): golf_courses table, written for v2"
```

---

## Task 2: Course input rules (API)

**Files:** Create `src/lib/golf/courseInput.ts`; test `src/__tests__/golfCourseInput.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts title="api:src/__tests__/golfCourseInput.test.ts"
import { describe, it, expect } from 'vitest';
import { golfCourseInputSchema, slugify } from '@/lib/golf/courseInput';

/**
 * What an admin may say about a golf course. The database repeats the hard limits as CHECKs; these
 * are the same limits, refused field by field so the form can say which one is wrong.
 */

const base = { name: 'Wack Wack Golf', country: 'Philippines', city: 'Mandaluyong', holes: 18 };

describe('slugify', () => {
    it('joins its parts and keeps a-z and digits', () => {
        expect(slugify('Wack Wack Golf', 'Mandaluyong')).toBe('wack-wack-golf-mandaluyong');
    });

    it('drops accents rather than the letters under them', () => {
        expect(slugify('Club de Golf Señorial', 'Bogotá')).toBe('club-de-golf-senorial-bogota');
    });

    it('collapses punctuation and trims hyphens', () => {
        expect(slugify('  --Sky72: Ocean & Lake--  ')).toBe('sky72-ocean-lake');
    });

    it('stops at 120 characters without ending on a hyphen', () => {
        const slug = slugify(`${'a'.repeat(119)} b`);
        expect(slug.length).toBeLessThanOrEqual(120);
        expect(slug.endsWith('-')).toBe(false);
    });

    it('has nothing to offer a name with no Latin letters', () => {
        expect(slugify('제주 골프', '서귀포')).toBe('');
    });
});

describe('golfCourseInputSchema', () => {
    it('accepts the least a course needs and fills in the rest', () => {
        expect(golfCourseInputSchema.parse(base)).toEqual({
            ...base, slug: null, address: null, description: '', par: null, greenFeeFrom: null,
            currency: 'USD', imageUrls: [], amenities: [],
        });
    });

    it('reads empty form fields as not given', () => {
        const out = golfCourseInputSchema.parse({ ...base, slug: '', address: '  ', par: '', greenFeeFrom: '' });
        expect(out).toMatchObject({ slug: null, address: null, par: null, greenFeeFrom: null });
    });

    it('trims text and upper-cases the currency', () => {
        expect(golfCourseInputSchema.parse({ ...base, name: '  Wack Wack  ', currency: 'php' }))
            .toMatchObject({ name: 'Wack Wack', currency: 'PHP' });
    });

    it('refuses what the database would refuse, field by field', () => {
        const result = golfCourseInputSchema.safeParse({
            ...base, name: '', holes: 12, par: 20, greenFeeFrom: -1, currency: 'PESO', slug: 'Not A Slug',
        });
        expect(result.success).toBe(false);
        expect(Object.keys(result.error!.flatten().fieldErrors).sort())
            .toEqual(['currency', 'greenFeeFrom', 'holes', 'name', 'par', 'slug']);
    });

    it('takes images over https only', () => {
        expect(golfCourseInputSchema.safeParse({ ...base, imageUrls: ['http://example.com/a.jpg'] }).success).toBe(false);
        expect(golfCourseInputSchema.parse({ ...base, imageUrls: ['https://example.com/a.jpg'] }).imageUrls)
            .toEqual(['https://example.com/a.jpg']);
    });

    it('knows the amenity list, and lists each one once', () => {
        expect(golfCourseInputSchema.safeParse({ ...base, amenities: ['jacuzzi'] }).success).toBe(false);
        expect(golfCourseInputSchema.parse({ ...base, amenities: ['cart', 'caddie', 'cart'] }).amenities)
            .toEqual(['cart', 'caddie']);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/golfCourseInput.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/golf/courseInput"`.

- [ ] **Step 3: Write the module**

```ts title="api:src/lib/golf/courseInput.ts"
/**
 * What an admin may say about a golf course, and how its URL key is made.
 *
 * Ported from v1's `src/lib/schemas/golf.ts` (feat/golf-courses @ 0cb892d6), catalogue fields only:
 * tee times, policies and course facts come with the slices that use them. The database repeats the
 * hard limits as CHECKs (db/migrations/20261104000001_golf_courses.sql); this is where they are
 * explained to the person typing.
 */

import { z } from 'zod';

/** What a course can list. Closed, because the storefront has a label for each in every language. */
export const GOLF_AMENITIES = [
    'caddie', 'cart', 'driving_range', 'putting_green', 'clubhouse',
    'restaurant', 'club_rental', 'pro_shop', 'lessons', 'night_golf',
] as const;
export type GolfAmenity = (typeof GOLF_AMENITIES)[number];

export const GOLF_COURSE_STATUSES = ['draft', 'published'] as const;
export type GolfCourseStatus = (typeof GOLF_COURSE_STATUSES)[number];

const HOLES = [9, 18, 27, 36];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A URL key from any text: accents dropped, every run of anything but a-z and 0-9 collapsed to one
 * hyphen, at most 120 characters, never starting or ending with a hyphen. Text with no Latin
 * letters or digits at all (a Hangul name) has no slug, and gives ''.
 */
export function slugify(...parts: string[]): string {
    return parts
        .join(' ')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120)
        .replace(/-+$/, '');
}

/** A form sends '' for a field left empty; that means "not given". */
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const required = (max: number) => z.string().trim().min(1, 'Required').max(max);
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blank, schema.nullable()).default(null);

export const golfCourseInputSchema = z.object({
    slug:         optional(z.string().trim().max(120).regex(SLUG, 'Lowercase letters, digits and single hyphens only')),
    name:         required(200),
    country:      required(100),
    city:         required(100),
    address:      optional(z.string().trim().max(300)),
    description:  z.string().trim().max(10_000).default(''),
    holes:        z.coerce.number().int().refine((n) => HOLES.includes(n), 'Must be 9, 18, 27 or 36'),
    par:          optional(z.coerce.number().int().min(27, 'At least 27').max(144, 'At most 144')),
    greenFeeFrom: optional(z.coerce.number().min(0, 'Cannot be negative').max(99_999_999.99)),
    currency:     z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Three letters, e.g. USD').default('USD'),
    imageUrls:    z.array(z.string().trim().url('Not a URL').startsWith('https://', 'Must start with https://')).max(20).default([]),
    amenities:    z.array(z.enum(GOLF_AMENITIES)).default([]).transform((a) => [...new Set(a)]),
});

export type GolfCourseInput = z.infer<typeof golfCourseInputSchema>;
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/golfCourseInput.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/golf/courseInput.ts src/__tests__/golfCourseInput.test.ts
git commit -m "feat(golf): course input schema and slugify, ported from v1"
```

---

## Task 3: Repository (API)

**Files:** Create `src/repositories/golf.repository.ts`; test `src/__tests__/golf.repository.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts title="api:src/__tests__/golf.repository.test.ts"
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { GolfRepository, SlugTakenError, type GolfCourseRecord } from '@/repositories/golf.repository';

const sql    = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');
const values = (call: unknown[]) => call.slice(1);

const ROW = {
    id: '0b6c7a2e-1111-4a5b-9c3d-000000000001', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines',
    city: 'Mandaluyong', address: null, description: 'Two courses.', holes: 36, par: 72,
    green_fee_from: '85.50', currency: 'USD', image_urls: ['https://img.example/a.jpg'], amenities: ['caddie'],
    status: 'published', created_at: new Date('2026-11-01T00:00:00Z'), updated_at: new Date('2026-11-02T00:00:00Z'),
};

const RECORD: GolfCourseRecord = {
    slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85.5, currency: 'USD', imageUrls: [], amenities: [],
};

let repo: GolfRepository;

beforeEach(() => {
    vi.clearAllMocks();
    db.$queryRaw.mockResolvedValue([]);
    db.$executeRaw.mockResolvedValue(0);
    repo = new GolfRepository();
});

describe('mapping', () => {
    it('speaks camelCase and numbers, not rows and decimals', async () => {
        db.$queryRaw.mockResolvedValueOnce([ROW]);
        expect(await repo.findBySlug('wack-wack')).toEqual({
            id: ROW.id, slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong',
            address: null, description: 'Two courses.', holes: 36, par: 72, greenFeeFrom: 85.5, currency: 'USD',
            imageUrls: ['https://img.example/a.jpg'], amenities: ['caddie'], status: 'published',
            createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z',
        });
    });

    it('keeps an unpriced course unpriced', async () => {
        db.$queryRaw.mockResolvedValueOnce([{ ...ROW, green_fee_from: null }]);
        expect((await repo.findBySlug('wack-wack'))!.greenFeeFrom).toBeNull();
    });
});

describe('listPublished', () => {
    it('asks for published courses only, in every country when none is named', async () => {
        await repo.listPublished();
        const call = db.$queryRaw.mock.calls[0];
        expect(sql(call)).toContain("status = 'published'");
        expect(values(call)).toEqual([null, null]);
    });

    it('narrows to the country it is given', async () => {
        await repo.listPublished('Philippines');
        expect(values(db.$queryRaw.mock.calls[0])).toEqual(['Philippines', 'Philippines']);
    });
});

describe('listForAdmin', () => {
    it('treats wildcards typed into the search as text', async () => {
        db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
        await repo.listForAdmin({ query: '50%_off', page: 1, pageSize: 20 });
        expect(values(db.$queryRaw.mock.calls[0])).toContain('%50\\%\\_off%');
    });

    it('pages, and counts every match', async () => {
        db.$queryRaw.mockResolvedValueOnce([ROW]).mockResolvedValueOnce([{ total: 41 }]);
        const out = await repo.listForAdmin({ page: 3, pageSize: 20 });
        expect(values(db.$queryRaw.mock.calls[0])).toEqual([null, null, null, null, 20, 40]);
        expect(out.total).toBe(41);
        expect(out.courses).toHaveLength(1);
    });
});

describe('writes', () => {
    it('reports a slug another course holds as SlugTakenError', async () => {
        db.$queryRaw.mockRejectedValueOnce(Object.assign(
            new Error('Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "golf_courses_slug_key"`'),
            { code: 'P2010', meta: { code: '23505' } },
        ));
        await expect(repo.create(RECORD)).rejects.toBeInstanceOf(SlugTakenError);
    });

    it('lets any other failure through as it was', async () => {
        const boom = new Error('connection reset');
        db.$queryRaw.mockRejectedValueOnce(boom);
        await expect(repo.create(RECORD)).rejects.toBe(boom);
    });

    it('answers null for an update to a course that is not there', async () => {
        expect(await repo.update(ROW.id, RECORD)).toBeNull();
        expect(await repo.setStatus(ROW.id, 'published')).toBeNull();
    });

    it('says whether a delete removed anything', async () => {
        db.$executeRaw.mockResolvedValueOnce(1);
        expect(await repo.delete(ROW.id)).toBe(true);
        expect(await repo.delete(ROW.id)).toBe(false);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/golf.repository.test.ts`
Expected: FAIL — cannot resolve `@/repositories/golf.repository`.

- [ ] **Step 3: Write the repository**

```ts title="api:src/repositories/golf.repository.ts"
/**
 * The golf catalogue's data (CONTEXT.md, "Golf Course"): the `golf_courses` table, and the mapping
 * from its rows to the `GolfCourse` the rest of the API speaks of.
 *
 * Which courses a customer may see is not decided here. `findBySlug` returns drafts too;
 * GolfService is where "published only" lives, once.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { GolfAmenity, GolfCourseInput, GolfCourseStatus } from '@/lib/golf/courseInput';

export interface GolfCourse {
    id:           string;
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    address:      string | null;
    description:  string;
    holes:        number;
    par:          number | null;
    /** A guide "from" price per player in `currency`. Never a quote. */
    greenFeeFrom: number | null;
    currency:     string;
    /** In display order; the first is the cover. */
    imageUrls:    string[];
    amenities:    GolfAmenity[];
    status:       GolfCourseStatus;
    createdAt:    string;
    updatedAt:    string;
}

/** A course as it is written: the admin's input with its slug decided. */
export type GolfCourseRecord = Omit<GolfCourseInput, 'slug'> & { slug: string };

/** The slug belongs to another course. */
export class SlugTakenError extends Error {
    constructor(readonly slug: string) {
        super(`Another golf course already uses the slug "${slug}".`);
        this.name = 'SlugTakenError';
    }
}

interface GolfCourseRow {
    id:             string;
    slug:           string;
    name:           string;
    country:        string;
    city:           string;
    address:        string | null;
    description:    string;
    holes:          number;
    par:            number | null;
    green_fee_from: Prisma.Decimal | string | number | null;
    currency:       string;
    image_urls:     string[] | null;
    amenities:      string[] | null;
    status:         string;
    created_at:     Date;
    updated_at:     Date;
}

function toCourse(r: GolfCourseRow): GolfCourse {
    return {
        id:           r.id,
        slug:         r.slug,
        name:         r.name,
        country:      r.country,
        city:         r.city,
        address:      r.address,
        description:  r.description,
        holes:        Number(r.holes),
        par:          r.par == null ? null : Number(r.par),
        greenFeeFrom: r.green_fee_from == null ? null : Number(r.green_fee_from),
        // char(3): Postgres pads to the width, so trim rather than trust it.
        currency:     r.currency.trim(),
        imageUrls:    r.image_urls ?? [],
        amenities:    (r.amenities ?? []) as GolfAmenity[],
        status:       r.status as GolfCourseStatus,
        createdAt:    new Date(r.created_at).toISOString(),
        updatedAt:    new Date(r.updated_at).toISOString(),
    };
}

/** Postgres's unique_violation, as Prisma reports it from a raw query (P2010 carrying 23505). */
function isUniqueViolation(err: unknown): boolean {
    const e = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
    return e?.code === 'P2002' || e?.meta?.code === '23505' || /\b23505\b/.test(String(e?.message ?? ''));
}

/** `%` and `_` typed into the search box are text to find, not wildcards. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export class GolfRepository {
    /** Published courses by name, in one country or all of them. */
    async listPublished(country?: string): Promise<GolfCourse[]> {
        const only = country ?? null;
        const rows = await prisma.$queryRaw<GolfCourseRow[]>`
            SELECT * FROM golf_courses
            WHERE status = 'published' AND (${only}::text IS NULL OR country = ${only})
            ORDER BY name`;
        return rows.map(toCourse);
    }

    /** Every country with at least one published course: what the storefront can filter by. */
    async listPublishedCountries(): Promise<string[]> {
        const rows = await prisma.$queryRaw<Array<{ country: string }>>`
            SELECT DISTINCT country FROM golf_courses WHERE status = 'published' ORDER BY country`;
        return rows.map((r) => r.country);
    }

    /** Any course with this slug, draft or not. */
    async findBySlug(slug: string): Promise<GolfCourse | null> {
        const rows = await prisma.$queryRaw<GolfCourseRow[]>`
            SELECT * FROM golf_courses WHERE slug = ${slug} LIMIT 1`;
        return rows[0] ? toCourse(rows[0]) : null;
    }

    /** Every course, most recently changed first, matching `query` on name, city or country. */
    async listForAdmin(opts: { query?: string; page: number; pageSize: number }): Promise<{ courses: GolfCourse[]; total: number }> {
        const like   = opts.query ? likePattern(opts.query) : null;
        const offset = (opts.page - 1) * opts.pageSize;
        const [rows, counted] = await Promise.all([
            prisma.$queryRaw<GolfCourseRow[]>`
                SELECT * FROM golf_courses
                WHERE ${like}::text IS NULL OR name ILIKE ${like} OR city ILIKE ${like} OR country ILIKE ${like}
                ORDER BY updated_at DESC, name
                LIMIT ${opts.pageSize} OFFSET ${offset}`,
            prisma.$queryRaw<Array<{ total: number }>>`
                SELECT COUNT(*)::int AS total FROM golf_courses
                WHERE ${like}::text IS NULL OR name ILIKE ${like} OR city ILIKE ${like} OR country ILIKE ${like}`,
        ]);
        return { courses: rows.map(toCourse), total: Number(counted[0]?.total ?? 0) };
    }

    /** A new course. Always a draft: publishing is its own step. */
    async create(c: GolfCourseRecord): Promise<GolfCourse> {
        try {
            const rows = await prisma.$queryRaw<GolfCourseRow[]>`
                INSERT INTO golf_courses
                    (slug, name, country, city, address, description, holes, par, green_fee_from,
                     currency, image_urls, amenities)
                VALUES
                    (${c.slug}, ${c.name}, ${c.country}, ${c.city}, ${c.address}, ${c.description},
                     ${c.holes}::int, ${c.par}::int, ${c.greenFeeFrom}::numeric, ${c.currency},
                     ${c.imageUrls}::text[], ${c.amenities}::text[])
                RETURNING *`;
            return toCourse(rows[0]);
        } catch (err) {
            if (isUniqueViolation(err)) throw new SlugTakenError(c.slug);
            throw err;
        }
    }

    /** Everything an admin can edit, at once. Null when there is no such course. */
    async update(id: string, c: GolfCourseRecord): Promise<GolfCourse | null> {
        try {
            const rows = await prisma.$queryRaw<GolfCourseRow[]>`
                UPDATE golf_courses SET
                    slug = ${c.slug}, name = ${c.name}, country = ${c.country}, city = ${c.city},
                    address = ${c.address}, description = ${c.description}, holes = ${c.holes}::int,
                    par = ${c.par}::int, green_fee_from = ${c.greenFeeFrom}::numeric, currency = ${c.currency},
                    image_urls = ${c.imageUrls}::text[], amenities = ${c.amenities}::text[],
                    updated_at = now()
                WHERE id = ${id}::uuid
                RETURNING *`;
            return rows[0] ? toCourse(rows[0]) : null;
        } catch (err) {
            if (isUniqueViolation(err)) throw new SlugTakenError(c.slug);
            throw err;
        }
    }

    /** Publish or unpublish. Null when there is no such course. */
    async setStatus(id: string, status: GolfCourseStatus): Promise<GolfCourse | null> {
        const rows = await prisma.$queryRaw<GolfCourseRow[]>`
            UPDATE golf_courses SET status = ${status}, updated_at = now()
            WHERE id = ${id}::uuid
            RETURNING *`;
        return rows[0] ? toCourse(rows[0]) : null;
    }

    /** Whether there was a course to delete. */
    async delete(id: string): Promise<boolean> {
        const removed = await prisma.$executeRaw`DELETE FROM golf_courses WHERE id = ${id}::uuid`;
        return removed > 0;
    }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/golf.repository.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/golf.repository.ts src/__tests__/golf.repository.test.ts
git commit -m "feat(golf): golf course repository"
```

---

## Task 4: Service (API)

**Files:** Create `src/services/golf.service.ts`; test `src/__tests__/golf.service.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts title="api:src/__tests__/golf.service.test.ts"
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { GolfService, type GolfStore } from '@/services/golf.service';
import type { GolfCourse, GolfCourseRecord } from '@/repositories/golf.repository';
import type { RatesResult } from '@/services/exchange-rates.service';
import { AppError } from '@/middleware/error.middleware';
import { golfCourseInputSchema, type GolfCourseStatus } from '@/lib/golf/courseInput';

/**
 * The catalogue's two rules: a customer sees published courses only, and a "from" fee is restated
 * in the viewer's currency as a guide, so a conversion that cannot be made leaves the course's own
 * figure rather than none.
 */

const ID = '0b6c7a2e-1111-4a5b-9c3d-000000000001';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: ID, slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 18, par: 72, greenFeeFrom: 100, currency: 'USD', imageUrls: [], amenities: [],
    status: 'published', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...over,
});

const RATES: RatesResult = {
    rates: { USD: 1, KRW: 0.00075, PHP: 0.0175 }, source: 'live', provider: 'test', fetchedAt: Date.now(), missing: [],
};

function fakeRepo() {
    return {
        listPublished:          vi.fn(async (_country?: string) => [] as GolfCourse[]),
        listPublishedCountries: vi.fn(async () => [] as string[]),
        findBySlug:             vi.fn(async (_slug: string) => null as GolfCourse | null),
        listForAdmin:           vi.fn(async (_o: { query?: string; page: number; pageSize: number }) => ({ courses: [] as GolfCourse[], total: 0 })),
        create:                 vi.fn(async (r: GolfCourseRecord) => course({ slug: r.slug })),
        update:                 vi.fn(async (_id: string, _r: GolfCourseRecord) => null as GolfCourse | null),
        setStatus:              vi.fn(async (_id: string, _s: GolfCourseStatus) => null as GolfCourse | null),
        delete:                 vi.fn(async (_id: string) => false),
    } satisfies GolfStore;
}

let repo: ReturnType<typeof fakeRepo>;
let rates: ReturnType<typeof vi.fn<() => Promise<RatesResult | null>>>;
let svc: GolfService;

beforeEach(() => {
    repo  = fakeRepo();
    rates = vi.fn<() => Promise<RatesResult | null>>(async () => RATES);
    svc   = new GolfService(repo, rates);
});

describe('what a customer sees', () => {
    it('hides a draft as if it did not exist', async () => {
        repo.findBySlug.mockResolvedValueOnce(course({ status: 'draft' }));
        expect(await svc.getPublished('wack-wack')).toBeNull();
    });

    it('shows a published course', async () => {
        repo.findBySlug.mockResolvedValueOnce(course());
        expect((await svc.getPublished('wack-wack'))?.slug).toBe('wack-wack');
    });

    it('lists with the countries to filter by, and passes the country down', async () => {
        repo.listPublished.mockResolvedValueOnce([course()]);
        repo.listPublishedCountries.mockResolvedValueOnce(['Japan', 'Philippines']);
        const out = await svc.listPublished({ country: 'Philippines' });
        expect(repo.listPublished).toHaveBeenCalledWith('Philippines');
        expect(out.countries).toEqual(['Japan', 'Philippines']);
        expect(out.courses).toHaveLength(1);
    });
});

describe("the 'from' fee in the viewer's currency", () => {
    it('is restated from the course currency, to the cent', async () => {
        repo.findBySlug.mockResolvedValueOnce(course({ greenFeeFrom: 85, currency: 'USD' }));
        expect(await svc.getPublished('wack-wack', 'krw')).toMatchObject({ currency: 'KRW', greenFeeFrom: 113333.33 });
    });

    it("stays the course's own figure when there are no rates", async () => {
        rates.mockResolvedValueOnce(null);
        repo.findBySlug.mockResolvedValueOnce(course({ greenFeeFrom: 85, currency: 'USD' }));
        expect(await svc.getPublished('wack-wack', 'KRW')).toMatchObject({ currency: 'USD', greenFeeFrom: 85 });
    });

    it('stays put when the rate lookup itself fails', async () => {
        rates.mockRejectedValueOnce(new Error('timeout'));
        repo.findBySlug.mockResolvedValueOnce(course({ greenFeeFrom: 85, currency: 'USD' }));
        expect(await svc.getPublished('wack-wack', 'KRW')).toMatchObject({ currency: 'USD', greenFeeFrom: 85 });
    });

    it('asks for no rates it does not need', async () => {
        repo.listPublished.mockResolvedValueOnce([course({ currency: 'KRW', greenFeeFrom: 90000 }), course({ greenFeeFrom: null })]);
        const out = await svc.listPublished({ currency: 'KRW' });
        expect(rates).not.toHaveBeenCalled();
        expect(out.courses.map((c) => c.currency)).toEqual(['KRW', 'USD']);
    });

    it('ignores a currency that is not one', async () => {
        repo.findBySlug.mockResolvedValueOnce(course());
        expect(await svc.getPublished('wack-wack', 'pesos')).toMatchObject({ currency: 'USD' });
        expect(rates).not.toHaveBeenCalled();
    });
});

describe('writes', () => {
    const input = golfCourseInputSchema.parse({ name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', holes: 18 });

    it('makes the slug from name and city when none is given', async () => {
        await svc.create(input);
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'wack-wack-mandaluyong' }));
    });

    it('keeps a slug that is given', async () => {
        await svc.create({ ...input, slug: 'wack-east' });
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'wack-east' }));
    });

    it('asks for a slug when the name and city have nothing a URL can use', async () => {
        const err = await svc.create({ ...input, name: '제주', city: '서귀포' }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ statusCode: 422, details: { details: { slug: [expect.any(String)] } } });
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('treats a malformed id as unknown, without asking the database', async () => {
        expect(await svc.update('not-a-uuid', input)).toBeNull();
        expect(await svc.setStatus('not-a-uuid', 'published')).toBeNull();
        expect(await svc.delete('not-a-uuid')).toBe(false);
        expect(repo.update).not.toHaveBeenCalled();
        expect(repo.setStatus).not.toHaveBeenCalled();
        expect(repo.delete).not.toHaveBeenCalled();
    });
});

describe('the admin list', () => {
    it('pages twenty at a time and says how many pages there are', async () => {
        repo.listForAdmin.mockResolvedValueOnce({ courses: [course()], total: 41 });
        const out = await svc.listForAdmin({ page: '3', q: ' wack ' });
        expect(repo.listForAdmin).toHaveBeenCalledWith({ query: 'wack', page: 3, pageSize: 20 });
        expect(out).toMatchObject({ total: 41, page: 3, pageSize: 20, totalPages: 3 });
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/golf.service.test.ts`
Expected: FAIL — cannot resolve `@/services/golf.service`.

- [ ] **Step 3: Write the service**

```ts title="api:src/services/golf.service.ts"
/**
 * The golf catalogue's rules (CONTEXT.md, "Golf Course").
 *
 * Two are decided here and nowhere else: a customer sees published courses only, and a "from" green
 * fee is restated in the viewer's Display Currency, as a guide. A conversion that cannot be made
 * leaves the course's own figure in its own currency rather than showing none.
 */

import { AppError } from '@/middleware/error.middleware';
import { makeStrictConverter } from '@/lib/payments/convertStrict';
import { slugify, type GolfCourseInput, type GolfCourseStatus } from '@/lib/golf/courseInput';
import { ExchangeRatesService, type RatesResult } from '@/services/exchange-rates.service';
import { readPage, type AdminListQuery } from '@/services/adminContent.service';
import { GolfRepository, type GolfCourse, type GolfCourseRecord } from '@/repositories/golf.repository';

export type GolfStore = Pick<GolfRepository,
    'listPublished' | 'listPublishedCountries' | 'findBySlug' | 'listForAdmin' | 'create' | 'update' | 'setStatus' | 'delete'>;

const UUID     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY = /^[A-Z]{3}$/;

export class GolfService {
    constructor(
        private readonly repo: GolfStore = new GolfRepository(),
        private readonly rates: () => Promise<RatesResult | null> = () => new ExchangeRatesService().getLiveRates(),
    ) {}

    /** The storefront's list, and every country it can be narrowed to. */
    async listPublished(opts: { country?: string; currency?: string } = {}) {
        const [courses, countries] = await Promise.all([
            this.repo.listPublished(opts.country),
            this.repo.listPublishedCountries(),
        ]);
        return { courses: await this.inCurrency(courses, opts.currency), countries };
    }

    /** A course page, or null: a draft is as absent to a customer as a slug that never existed. */
    async getPublished(slug: string, currency?: string): Promise<GolfCourse | null> {
        const course = await this.repo.findBySlug(slug);
        if (!course || course.status !== 'published') return null;
        const [shown] = await this.inCurrency([course], currency);
        return shown;
    }

    async listForAdmin(query: AdminListQuery) {
        const { page, pageSize, query: q } = readPage(query);
        const { courses, total } = await this.repo.listForAdmin({ query: q, page, pageSize });
        return { data: courses, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    }

    async create(input: GolfCourseInput): Promise<GolfCourse> {
        return this.repo.create(withSlug(input));
    }

    // A malformed id names no course, so it is answered as an unknown one rather than handed to
    // Postgres to fail as an invalid uuid.
    async update(id: string, input: GolfCourseInput): Promise<GolfCourse | null> {
        return UUID.test(id) ? this.repo.update(id, withSlug(input)) : null;
    }

    async setStatus(id: string, status: GolfCourseStatus): Promise<GolfCourse | null> {
        return UUID.test(id) ? this.repo.setStatus(id, status) : null;
    }

    async delete(id: string): Promise<boolean> {
        return UUID.test(id) ? this.repo.delete(id) : false;
    }

    private async inCurrency(courses: GolfCourse[], currency?: string): Promise<GolfCourse[]> {
        const to = currency?.trim().toUpperCase();
        if (!to || !CURRENCY.test(to)) return courses;
        if (!courses.some((c) => c.greenFeeFrom != null && c.currency !== to)) return courses;

        const convert = makeStrictConverter(await this.rates().catch(() => null));
        return courses.map((c) => {
            if (c.greenFeeFrom == null || c.currency === to) return c;
            try {
                return { ...c, greenFeeFrom: Math.round(convert(c.greenFeeFrom, c.currency, to) * 100) / 100, currency: to };
            } catch {
                return c;
            }
        });
    }
}

/** The slug as given, or one made from the name and city. */
function withSlug(input: GolfCourseInput): GolfCourseRecord {
    const slug = input.slug ?? slugify(input.name, input.city);
    if (!slug) {
        // Shaped like a ZodError's answer, so the form shows it beside the slug field.
        throw new AppError(422, 'Invalid request data', 'VALIDATION_ERROR', {
            details: { slug: ['Add a slug: the name and city have no letters a URL can use.'] },
        });
    }
    return { ...input, slug };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/golf.service.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/golf.service.ts src/__tests__/golf.service.test.ts
git commit -m "feat(golf): catalogue service - published only, guide fee in the viewer's currency"
```

---

## Task 5: Controller, routes and mounting (API)

**Files:** Create `src/controllers/golf.controller.ts`, `src/routes/golf.route.ts`, `src/routes/admin-golf.route.ts`; modify `src/routes/index.ts`; test `src/__tests__/golf.routes.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts title="api:src/__tests__/golf.routes.test.ts"
/**
 * The golf endpoints over real HTTP: the storefront's two reads, and the admin's five actions behind
 * the admin role. The service is mocked; its rules have their own tests. What is checked here is the
 * translation — status codes, the envelope, where a refusal's details go.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type RequestHandler } from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const svc = vi.hoisted(() => ({
    listPublished: vi.fn(), getPublished: vi.fn(), listForAdmin: vi.fn(),
    create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), delete: vi.fn(),
}));
const audit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/services/golf.service', () => ({ GolfService: vi.fn(function () { return svc; }) }));
vi.mock('@/lib/admin/audit', () => ({ logAdminAction: audit }));
// Who is calling comes from a header, so a test can be anyone.
vi.mock('@/middleware/auth.middleware', async () => {
    const { AppError } = await import('@/middleware/error.middleware');
    const requireAuth: RequestHandler = (req, _res, next) => {
        const role = req.header('x-test-role');
        if (!role) return next(new AppError(401, 'Unauthorized', 'AUTH_REQUIRED'));
        req.user = { sub: 'admin-1', email: 'admin@example.com', role: role as never };
        next();
    };
    const requireRole = (...roles: string[]): RequestHandler => (req, _res, next) =>
        (roles.includes(req.user?.role ?? '') ? next() : next(new AppError(403, 'Forbidden', 'FORBIDDEN')));
    return { requireAuth, requireRole };
});

import golfRoutes from '@/routes/golf.route';
import adminGolfRoutes from '@/routes/admin-golf.route';
import { errorMiddleware } from '@/middleware/error.middleware';
import { SlugTakenError } from '@/repositories/golf.repository';

let server: Server;
let base = '';

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/golf', golfRoutes);
    app.use('/admin/golf', adminGolfRoutes);
    app.use(errorMiddleware);
    await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => vi.clearAllMocks());

const call = async (method: string, path: string, opts: { role?: string; body?: unknown } = {}) => {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(opts.role ? { 'x-test-role': opts.role } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
};

const ID     = '0b6c7a2e-1111-4a5b-9c3d-000000000001';
const COURSE = { id: ID, slug: 'wack-wack', name: 'Wack Wack' };
const VALID  = { name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', holes: 18 };

describe('storefront', () => {
    it('lists published courses, passing the country and currency down', async () => {
        svc.listPublished.mockResolvedValue({ courses: [COURSE], countries: ['Philippines'] });
        const res = await call('GET', '/golf/courses?country=Philippines&currency=KRW');
        expect(res).toEqual({ status: 200, body: { success: true, data: { courses: [COURSE], countries: ['Philippines'] } } });
        expect(svc.listPublished).toHaveBeenCalledWith({ country: 'Philippines', currency: 'KRW' });
    });

    it('answers 404 for a course a customer may not see', async () => {
        svc.getPublished.mockResolvedValue(null);
        const res = await call('GET', '/golf/courses/secret-draft');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('NOT_FOUND');
    });

    it('needs no session', async () => {
        svc.getPublished.mockResolvedValue(COURSE);
        expect(await call('GET', '/golf/courses/wack-wack?currency=PHP')).toEqual({ status: 200, body: { success: true, data: COURSE } });
        expect(svc.getPublished).toHaveBeenCalledWith('wack-wack', 'PHP');
    });
});

describe('admin', () => {
    it('refuses a visitor with no session, and a customer', async () => {
        expect((await call('GET', '/admin/golf/courses')).status).toBe(401);
        expect((await call('GET', '/admin/golf/courses', { role: 'user' })).status).toBe(403);
        expect(svc.listForAdmin).not.toHaveBeenCalled();
    });

    it('lists for an admin', async () => {
        svc.listForAdmin.mockResolvedValue({ data: [COURSE], total: 1, page: 1, pageSize: 20, totalPages: 1 });
        const res = await call('GET', '/admin/golf/courses?q=wack', { role: 'admin' });
        expect(res.body).toEqual({ success: true, data: [COURSE], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('names the fields that are wrong', async () => {
        const res = await call('POST', '/admin/golf/courses', { role: 'admin', body: { ...VALID, name: '', holes: 12 } });
        expect(res.status).toBe(422);
        expect(Object.keys(res.body.details).sort()).toEqual(['holes', 'name']);
        expect(svc.create).not.toHaveBeenCalled();
    });

    it('reports a taken slug against the slug field', async () => {
        svc.create.mockRejectedValue(new SlugTakenError('wack-wack'));
        const res = await call('POST', '/admin/golf/courses', { role: 'admin', body: VALID });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'SLUG_TAKEN', details: { slug: [expect.stringContaining('wack-wack')] } });
    });

    it('creates, and writes it down', async () => {
        svc.create.mockResolvedValue(COURSE);
        const res = await call('POST', '/admin/golf/courses', { role: 'admin', body: VALID });
        expect(res).toEqual({ status: 201, body: { success: true, data: COURSE } });
        expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Wack Wack', slug: null, currency: 'USD' }));
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'golf_course_create', adminId: 'admin-1', targetId: ID }));
    });

    it('answers 404 for an update, a status change or a delete of nothing', async () => {
        svc.update.mockResolvedValue(null);
        svc.setStatus.mockResolvedValue(null);
        svc.delete.mockResolvedValue(false);
        expect((await call('PUT', `/admin/golf/courses/${ID}`, { role: 'admin', body: VALID })).status).toBe(404);
        expect((await call('PATCH', `/admin/golf/courses/${ID}/status`, { role: 'admin', body: { status: 'published' } })).status).toBe(404);
        expect((await call('DELETE', `/admin/golf/courses/${ID}`, { role: 'admin' })).status).toBe(404);
        expect(audit).not.toHaveBeenCalled();
    });

    it('publishes, and refuses a status that does not exist', async () => {
        svc.setStatus.mockResolvedValue({ ...COURSE, status: 'published' });
        expect((await call('PATCH', `/admin/golf/courses/${ID}/status`, { role: 'admin', body: { status: 'live' } })).status).toBe(422);
        const res = await call('PATCH', `/admin/golf/courses/${ID}/status`, { role: 'admin', body: { status: 'published' } });
        expect(res.status).toBe(200);
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'golf_course_publish', targetId: ID }));
    });

    it('deletes with a body the app can read', async () => {
        svc.delete.mockResolvedValue(true);
        expect(await call('DELETE', `/admin/golf/courses/${ID}`, { role: 'admin' })).toEqual({ status: 200, body: { success: true } });
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'golf_course_delete', targetId: ID }));
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/golf.routes.test.ts`
Expected: FAIL — cannot resolve `@/routes/golf.route`.

- [ ] **Step 3: Write the controller and both route files**

```ts title="api:src/controllers/golf.controller.ts"
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '@/middleware/error.middleware';
import { logAdminAction } from '@/lib/admin/audit';
import { GOLF_COURSE_STATUSES, golfCourseInputSchema } from '@/lib/golf/courseInput';
import { SlugTakenError } from '@/repositories/golf.repository';
import { GolfService } from '@/services/golf.service';

/**
 * The golf catalogue over HTTP. Bodies are parsed here with the course schema rather than by the
 * `validate()` middleware, which checks a body but throws the parsed (trimmed, defaulted) value away.
 */

/** What the storefront sends. A malformed value is ignored rather than refused: it only narrows. */
const storefrontQuery = z.object({
    country:  z.string().trim().min(1).max(100).optional().catch(undefined),
    currency: z.string().trim().max(3).optional().catch(undefined),
});

const statusBody = z.object({ status: z.enum(GOLF_COURSE_STATUSES) });

const notFound = () => new AppError(404, 'Golf course not found', 'NOT_FOUND');

/** A taken slug is a mistake in one field, so it is reported against that field. */
function asHttp(err: unknown): unknown {
    if (err instanceof SlugTakenError) {
        return new AppError(409, err.message, 'SLUG_TAKEN', { details: { slug: [err.message] } });
    }
    return err;
}

/** Never awaited and never throws: an action must not fail because its audit row did. */
function audit(req: Request, action: string, targetId: string, details?: Record<string, unknown>) {
    void logAdminAction({ action, adminId: req.user!.sub, adminEmail: req.user!.email, targetId, details });
}

export class GolfController {
    constructor(private readonly svc = new GolfService()) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { country, currency } = storefrontQuery.parse(req.query);
            res.json({ success: true, data: await this.svc.listPublished({ country, currency }) });
        } catch (err) { next(err); }
    };

    get = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { currency } = storefrontQuery.parse(req.query);
            const course = await this.svc.getPublished(req.params.slug, currency);
            if (!course) throw notFound();
            res.json({ success: true, data: course });
        } catch (err) { next(err); }
    };

    adminList = async (req: Request, res: Response, next: NextFunction) => {
        try { res.json({ success: true, ...(await this.svc.listForAdmin(req.query)) }); }
        catch (err) { next(err); }
    };

    adminCreate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const course = await this.svc.create(golfCourseInputSchema.parse(req.body ?? {}));
            audit(req, 'golf_course_create', course.id, { slug: course.slug });
            res.status(201).json({ success: true, data: course });
        } catch (err) { next(asHttp(err)); }
    };

    adminUpdate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const course = await this.svc.update(req.params.id, golfCourseInputSchema.parse(req.body ?? {}));
            if (!course) throw notFound();
            audit(req, 'golf_course_update', course.id, { slug: course.slug });
            res.json({ success: true, data: course });
        } catch (err) { next(asHttp(err)); }
    };

    adminSetStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status } = statusBody.parse(req.body ?? {});
            const course = await this.svc.setStatus(req.params.id, status);
            if (!course) throw notFound();
            audit(req, status === 'published' ? 'golf_course_publish' : 'golf_course_unpublish', course.id, { slug: course.slug });
            res.json({ success: true, data: course });
        } catch (err) { next(err); }
    };

    // 200 with a body rather than 204: app-v2's http client parses every response.
    adminDelete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!(await this.svc.delete(req.params.id))) throw notFound();
            audit(req, 'golf_course_delete', req.params.id);
            res.json({ success: true });
        } catch (err) { next(err); }
    };
}
```

```ts title="api:src/routes/golf.route.ts"
import { Router } from 'express';
import { GolfController } from '@/controllers/golf.controller';

/**
 * The storefront's golf catalogue (CONTEXT.md, "Golf Course"). No session needed; published courses
 * only, which GolfService decides. Covered by the app-wide defaultRateLimit.
 */
const router: Router = Router();
const golf = new GolfController();

router.get('/courses',       golf.list);
router.get('/courses/:slug', golf.get);

export default router;
```

```ts title="api:src/routes/admin-golf.route.ts"
import { Router } from 'express';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';
import { GolfController } from '@/controllers/golf.controller';

/**
 * The golf catalogue's back office. Admins only: there is no supplier, so this is the one place a
 * course is written. Mounted before `/admin` so nothing in admin.route.ts can shadow it.
 */
const router: Router = Router();
const golf = new GolfController();

router.use(requireAuth, requireRole('admin'));

router.get('/courses',              golf.adminList);
router.post('/courses',             golf.adminCreate);
router.put('/courses/:id',          golf.adminUpdate);
router.patch('/courses/:id/status', golf.adminSetStatus);
router.delete('/courses/:id',       golf.adminDelete);

export default router;
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/golf.routes.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Mount the routers** — in `src/routes/index.ts`, add after `import emailRoutes …`:

```ts
import golfRoutes          from './golf.route';
import adminGolfRoutes     from './admin-golf.route';
```
and replace `router.use('/admin',          adminRoutes);` with:
```ts
router.use('/golf',           golfRoutes);
// Before '/admin', so that router's guard and routes never get the first look at these.
router.use('/admin/golf',     adminGolfRoutes);
router.use('/admin',          adminRoutes);
```

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit` — Expected: no new errors versus Task 0's baseline.
```bash
git add src/controllers/golf.controller.ts src/routes/golf.route.ts src/routes/admin-golf.route.ts src/routes/index.ts src/__tests__/golf.routes.test.ts
git commit -m "feat(golf): /golf/courses for the storefront, /admin/golf/courses for admins"
```

---

## Task 6: Glossary and a real-database smoke check (API)

- [ ] **Step 1: Add the glossary entry** — append to `CONTEXT.md`:

```md

## Golf Course

A course CheapestGo can arrange play at, curated by the team in the admin. There is no supplier behind it: a course exists because someone typed it in, and a customer sees it only once it is published — a draft is as absent from the storefront as a slug that never existed. Its **green fee from** is a guide per player in the course's own currency, restated in the viewer's Display Currency by `GolfService`. Until tee-time booking is ported, the course page's one action is the support chat.
_Avoid_: calling the green fee a price or a quote — nothing is charged from it, and checkout will quote its own.
```

- [ ] **Step 2: Smoke-check the SQL against the real table** (the unit tests mock Prisma, so this is the first time the casts meet Postgres)

Start the API (`npm run dev`, in the background), sign in as a local admin in app-v2 or reuse an admin session cookie, then:
```bash
curl -s "http://localhost:<api-port>/api/v2/golf/courses" ; echo
```
Expected: `{"success":true,"data":{"courses":[],"countries":[]}}`. Create, publish and delete one course through the admin screen in Task 12's manual check instead if no admin cookie is at hand.

- [ ] **Step 3: Run the whole API suite and commit**

Run: `npx vitest run 2>&1 | tail -5` — Expected: baseline + 45 new tests passing, no new failures.
```bash
git add CONTEXT.md && git commit -m "docs(golf): Golf Course in the glossary"
```

---

## Task 7: Types, API client, slugify and messages (APP)

**Files:** Create `src/features/golf/types.ts`, `lib/slugify.ts`, `api/golf.api.ts`, `__tests__/golf.api.test.ts`, `__tests__/golf-locales.test.ts`; modify the four locale files and `NEEDS_NATIVE_REVIEW.md`.

- [ ] **Step 1: Write the types, slugify and API client** (no behaviour of their own to test first beyond the client's URLs)

```ts title="app:src/features/golf/types.ts"
/**
 * A golf course as api-v2 sends it (api-v2 CONTEXT.md, "Golf Course").
 *
 * `greenFeeFrom` arrives already in the currency the page asked for, or in the course's own when it
 * could not be converted; `currency` says which. It is a guide, never a quote, and the browser never
 * converts it (CONTEXT.md, "Display Currency").
 */

export const GOLF_AMENITIES = [
    'caddie', 'cart', 'driving_range', 'putting_green', 'clubhouse',
    'restaurant', 'club_rental', 'pro_shop', 'lessons', 'night_golf',
] as const;
export type GolfAmenity = (typeof GOLF_AMENITIES)[number];

export const GOLF_HOLES = [9, 18, 27, 36] as const;

export type GolfCourseStatus = 'draft' | 'published';

export interface GolfCourse {
    id:           string;
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    address:      string | null;
    description:  string;
    holes:        number;
    par:          number | null;
    greenFeeFrom: number | null;
    currency:     string;
    /** In display order; the first is the cover. */
    imageUrls:    string[];
    amenities:    GolfAmenity[];
    status:       GolfCourseStatus;
    createdAt:    string;
    updatedAt:    string;
}

export interface GolfCatalogue {
    courses:   GolfCourse[];
    /** Every country with a published course, for the filter. */
    countries: string[];
}

/** What the admin form sends. An empty slug asks api-v2 to make one from the name and city. */
export interface GolfCourseDraft {
    slug:         string;
    name:         string;
    country:      string;
    city:         string;
    address:      string | null;
    description:  string;
    holes:        number;
    par:          number | null;
    greenFeeFrom: number | null;
    currency:     string;
    imageUrls:    string[];
    amenities:    GolfAmenity[];
}

export interface AdminGolfPage {
    data:       GolfCourse[];
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
}
```

```ts title="app:src/features/golf/lib/slugify.ts"
/**
 * The rule api-v2 makes a course's slug with (src/lib/golf/courseInput.ts), so the admin form can
 * show the slug a new course will get. The server applies it again; this is only the preview.
 */
export function slugify(...parts: string[]): string {
    return parts
        .join(' ')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120)
        .replace(/-+$/, '');
}
```

```ts title="app:src/features/golf/api/golf.api.ts"
import { http } from '@/shared/lib/http';
import type { AdminGolfPage, GolfCatalogue, GolfCourse, GolfCourseDraft, GolfCourseStatus } from '@/features/golf/types';

interface Envelope<T> {
    success: boolean;
    data:    T;
}

const query = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    const s = qs.toString();
    return s ? `?${s}` : '';
};

/** The storefront's list: published courses, and the countries it can be narrowed to. */
export async function fetchGolfCatalogue(opts: { country?: string; currency?: string } = {}): Promise<GolfCatalogue> {
    return (await http.get<Envelope<GolfCatalogue>>(`/golf/courses${query(opts)}`)).data;
}

/** One published course. Rejects with `status: 404` for a slug a customer may not see. */
export async function fetchGolfCourse(slug: string, currency?: string): Promise<GolfCourse> {
    return (await http.get<Envelope<GolfCourse>>(`/golf/courses/${encodeURIComponent(slug)}${query({ currency })}`)).data;
}

/** The back office's side: api-v2 `/admin/golf`, admins only. */
export const adminGolfApi = {
    list: (page: number, q?: string) =>
        http.get<AdminGolfPage>(`/admin/golf/courses${query({ page: String(page), q })}`),
    create: async (draft: GolfCourseDraft) =>
        (await http.post<Envelope<GolfCourse>>('/admin/golf/courses', draft)).data,
    update: async (id: string, draft: GolfCourseDraft) =>
        (await http.put<Envelope<GolfCourse>>(`/admin/golf/courses/${id}`, draft)).data,
    setStatus: async (id: string, status: GolfCourseStatus) =>
        (await http.patch<Envelope<GolfCourse>>(`/admin/golf/courses/${id}/status`, { status })).data,
    remove: (id: string) => http.delete<{ success: boolean }>(`/admin/golf/courses/${id}`),
};
```

- [ ] **Step 2: Write the client's test and the locale parity test**

```ts title="app:src/features/golf/__tests__/golf.api.test.ts"
import { describe, it, expect, vi, beforeEach } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/lib/http', () => ({ http }));

import { adminGolfApi, fetchGolfCatalogue, fetchGolfCourse } from '@/features/golf/api/golf.api';

beforeEach(() => vi.clearAllMocks());

describe('golf api', () => {
    it('asks for the list with only the filters it was given, and unwraps it', async () => {
        http.get.mockResolvedValue({ success: true, data: { courses: [], countries: [] } });
        expect(await fetchGolfCatalogue({ currency: 'KRW' })).toEqual({ courses: [], countries: [] });
        expect(http.get).toHaveBeenCalledWith('/golf/courses?currency=KRW');
        await fetchGolfCatalogue();
        expect(http.get).toHaveBeenLastCalledWith('/golf/courses');
    });

    it('escapes the slug and passes the currency', async () => {
        http.get.mockResolvedValue({ success: true, data: { slug: 'a b' } });
        await fetchGolfCourse('a b', 'PHP');
        expect(http.get).toHaveBeenCalledWith('/golf/courses/a%20b?currency=PHP');
    });

    it('pages the admin list and sends a search only when there is one', async () => {
        http.get.mockResolvedValue({ data: [], total: 0, page: 2, pageSize: 20, totalPages: 1 });
        await adminGolfApi.list(2);
        expect(http.get).toHaveBeenCalledWith('/admin/golf/courses?page=2');
        await adminGolfApi.list(1, 'wack');
        expect(http.get).toHaveBeenLastCalledWith('/admin/golf/courses?page=1&q=wack');
    });
});
```

```ts title="app:src/features/golf/__tests__/golf-locales.test.ts"
import { describe, it, expect } from 'vitest';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';
import { GOLF_AMENITIES } from '@/features/golf/types';

/**
 * Golf's strings exist in every language. next-intl shows a missing key as the key itself, so a
 * Korean page with one gap reads "golf.emptyTitle" where a sentence should be.
 */

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));

describe('golf messages', () => {
    it.each([['ko', ko], ['ja', ja], ['zh', zh]] as const)('%s has exactly the keys English has', (_, messages) => {
        expect(keys(messages.golf as Tree).sort()).toEqual(keys(en.golf as Tree).sort());
    });

    it('labels every amenity a course can list', () => {
        expect(Object.keys(en.golf.amenities).sort()).toEqual([...GOLF_AMENITIES].sort());
    });

    it.each([['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as const)('%s names the search bar Golf tab', (_, messages) => {
        expect(messages.landing.search.searchMode.golf).toBeTruthy();
    });
});
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run src/features/golf`
Expected: the api test PASSES (its module exists); the locale test FAILS — `messages.golf` is undefined.

- [ ] **Step 4: Check the locale files survive a JSON round-trip** (so a script can edit them without reformatting)

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-app-v2-nearby && for l in en ko ja zh; do node -e "const fs=require('fs');const s=fs.readFileSync('src/locales/$l.json','utf8');const o=JSON.stringify(JSON.parse(s),null,4)+'\n';console.log('$l', s===o?'round-trips':'DIFFERS')"; done
```
Expected: `round-trips` for all four. If one differs, edit that file by hand with the same values instead of Step 5's script.

- [ ] **Step 5: Add the messages** — run this script once (it writes the `golf` namespace, `landing.search.searchMode.golf`, and the new `landing.journey.options.golfNote`, keeping key order elsewhere):

```js title="app:scratch/add-golf-messages.cjs"
const fs = require('fs');
const path = require('path');

const golf = {
    en: {
        metaTitle: 'Golf courses',
        metaDescription: 'Golf courses our team can arrange play at, with a guide green fee and tee times on request.',
        courseMetaTitle: '{name} — golf',
        eyebrow: 'Golf',
        title: 'Golf courses',
        subtitle: 'Courses our team can arrange play at. Pick one and ask us about tee times.',
        allCountries: 'All countries',
        filterLabel: 'Filter by country',
        holes: '{holes} holes',
        par: 'Par {par}',
        greenFeesFrom: 'Green fees from {price}',
        fromLabel: 'Green fees from',
        guidePrice: 'A guide price per player. We confirm the exact fee when you ask about a tee time.',
        amenitiesTitle: 'At the course',
        aboutTitle: 'About the course',
        addressTitle: 'Address',
        askTeeTimes: 'Ask about tee times',
        askHint: 'Our team replies in the support chat.',
        askSignIn: 'Sign in to chat with our team about tee times.',
        photo: 'Photo {n}',
        breadcrumb: 'Golf',
        emptyTitle: 'No courses yet',
        emptyBody: "We're adding golf courses. Check back soon.",
        emptyCountryTitle: 'No courses in {country}',
        emptyCountryBody: 'Try another country, or see every course.',
        seeAll: 'See all courses',
        errorTitle: "Golf courses didn't load",
        errorBody: 'Something went wrong on our side. Please try again.',
        retry: 'Try again',
        missingTitle: "This course isn't available",
        missingBody: 'It may have been removed. See the courses we can arrange.',
        amenities: {
            caddie: 'Caddies', cart: 'Golf carts', driving_range: 'Driving range', putting_green: 'Putting green',
            clubhouse: 'Clubhouse', restaurant: 'Restaurant', club_rental: 'Club rental', pro_shop: 'Pro shop',
            lessons: 'Lessons', night_golf: 'Night golf',
        },
    },
    ko: {
        metaTitle: '골프장',
        metaDescription: '저희 팀이 라운드를 주선해 드리는 골프장입니다. 그린피 참고가를 확인하고 티타임을 문의하세요.',
        courseMetaTitle: '{name} — 골프',
        eyebrow: '골프',
        title: '골프장',
        subtitle: '저희 팀이 라운드를 주선해 드리는 골프장입니다. 마음에 드는 곳을 골라 티타임을 문의하세요.',
        allCountries: '전체 국가',
        filterLabel: '국가별 보기',
        holes: '{holes}홀',
        par: '파 {par}',
        greenFeesFrom: '그린피 {price}부터',
        fromLabel: '그린피 최저',
        guidePrice: '1인 기준 참고 요금입니다. 티타임을 문의하시면 정확한 요금을 안내해 드립니다.',
        amenitiesTitle: '부대시설',
        aboutTitle: '골프장 소개',
        addressTitle: '주소',
        askTeeTimes: '티타임 문의하기',
        askHint: '고객지원 채팅으로 저희 팀이 답변해 드립니다.',
        askSignIn: '로그인하시면 채팅으로 티타임을 문의하실 수 있습니다.',
        photo: '사진 {n}',
        breadcrumb: '골프',
        emptyTitle: '아직 등록된 골프장이 없습니다',
        emptyBody: '골프장을 준비하고 있습니다. 곧 다시 확인해 주세요.',
        emptyCountryTitle: '{country}에는 골프장이 없습니다',
        emptyCountryBody: '다른 국가를 선택하거나 전체 골프장을 확인해 보세요.',
        seeAll: '전체 골프장 보기',
        errorTitle: '골프장을 불러오지 못했습니다',
        errorBody: '일시적인 문제가 발생했습니다. 다시 시도해 주세요.',
        retry: '다시 시도',
        missingTitle: '이 골프장은 볼 수 없습니다',
        missingBody: '삭제되었을 수 있습니다. 주선 가능한 골프장을 확인해 보세요.',
        amenities: {
            caddie: '캐디', cart: '골프 카트', driving_range: '드라이빙 레인지', putting_green: '퍼팅 그린',
            clubhouse: '클럽하우스', restaurant: '레스토랑', club_rental: '클럽 대여', pro_shop: '프로숍',
            lessons: '레슨', night_golf: '야간 골프',
        },
    },
    ja: {
        metaTitle: 'ゴルフ場',
        metaDescription: '当チームがプレーを手配できるゴルフ場です。グリーンフィーの目安を確認し、ティータイムはお問い合わせください。',
        courseMetaTitle: '{name} — ゴルフ',
        eyebrow: 'ゴルフ',
        title: 'ゴルフ場',
        subtitle: '当チームがプレーを手配できるゴルフ場です。気になるコースを選んで、ティータイムをお問い合わせください。',
        allCountries: 'すべての国',
        filterLabel: '国で絞り込む',
        holes: '{holes}ホール',
        par: 'パー{par}',
        greenFeesFrom: 'グリーンフィー {price}〜',
        fromLabel: 'グリーンフィー',
        guidePrice: '1名あたりの目安料金です。ティータイムのお問い合わせ時に正確な料金をご案内します。',
        amenitiesTitle: '施設・サービス',
        aboutTitle: 'コース紹介',
        addressTitle: '住所',
        askTeeTimes: 'ティータイムを問い合わせる',
        askHint: 'サポートチャットで当チームがお答えします。',
        askSignIn: 'ログインすると、チャットでティータイムをお問い合わせいただけます。',
        photo: '写真 {n}',
        breadcrumb: 'ゴルフ',
        emptyTitle: 'まだゴルフ場がありません',
        emptyBody: 'ゴルフ場を準備中です。しばらくしてからご確認ください。',
        emptyCountryTitle: '{country}のゴルフ場はありません',
        emptyCountryBody: '別の国を選ぶか、すべてのゴルフ場をご覧ください。',
        seeAll: 'すべてのゴルフ場を見る',
        errorTitle: 'ゴルフ場を読み込めませんでした',
        errorBody: '問題が発生しました。もう一度お試しください。',
        retry: '再試行',
        missingTitle: 'このゴルフ場はご覧いただけません',
        missingBody: '削除された可能性があります。手配可能なゴルフ場をご覧ください。',
        amenities: {
            caddie: 'キャディ', cart: 'ゴルフカート', driving_range: '練習場', putting_green: 'パッティンググリーン',
            clubhouse: 'クラブハウス', restaurant: 'レストラン', club_rental: 'レンタルクラブ', pro_shop: 'プロショップ',
            lessons: 'レッスン', night_golf: 'ナイター',
        },
    },
    zh: {
        metaTitle: '高尔夫球场',
        metaDescription: '我们团队可为您安排打球的高尔夫球场。查看果岭费参考价，开球时间欢迎咨询。',
        courseMetaTitle: '{name} — 高尔夫',
        eyebrow: '高尔夫',
        title: '高尔夫球场',
        subtitle: '我们团队可为您安排打球的球场。选好球场，向我们咨询开球时间。',
        allCountries: '所有国家',
        filterLabel: '按国家筛选',
        holes: '{holes} 洞',
        par: '标准杆 {par}',
        greenFeesFrom: '果岭费 {price} 起',
        fromLabel: '果岭费',
        guidePrice: '每位球员的参考价格。咨询开球时间时，我们会确认准确费用。',
        amenitiesTitle: '球场设施',
        aboutTitle: '球场介绍',
        addressTitle: '地址',
        askTeeTimes: '咨询开球时间',
        askHint: '我们的团队会在客服聊天中回复您。',
        askSignIn: '登录后即可通过聊天咨询开球时间。',
        photo: '照片 {n}',
        breadcrumb: '高尔夫',
        emptyTitle: '暂无球场',
        emptyBody: '我们正在添加高尔夫球场，请稍后再来看看。',
        emptyCountryTitle: '{country}暂无球场',
        emptyCountryBody: '试试其他国家，或查看所有球场。',
        seeAll: '查看所有球场',
        errorTitle: '球场加载失败',
        errorBody: '我们这边出了点问题，请重试。',
        retry: '重试',
        missingTitle: '该球场暂不可见',
        missingBody: '它可能已被移除。看看我们可以安排的其他球场。',
        amenities: {
            caddie: '球童', cart: '球车', driving_range: '练习场', putting_green: '推杆果岭',
            clubhouse: '会所', restaurant: '餐厅', club_rental: '球杆租赁', pro_shop: '专卖店',
            lessons: '课程', night_golf: '夜间高尔夫',
        },
    },
};

const tab = { en: 'Golf', ko: '골프', ja: 'ゴルフ', zh: '高尔夫' };
const golfNote = {
    en: 'Curated courses, tee times on request',
    ko: '엄선한 골프장, 티타임은 문의로',
    ja: '厳選コース、ティータイムはお問い合わせで',
    zh: '精选球场，开球时间可咨询',
};

for (const locale of Object.keys(golf)) {
    const file = path.join(__dirname, '..', 'src', 'locales', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
    messages.golf = golf[locale];
    messages.landing.search.searchMode.golf = tab[locale];
    messages.landing.journey.options.golfNote = golfNote[locale];
    fs.writeFileSync(file, `${JSON.stringify(messages, null, 4)}\n`);
    console.log(`${locale}: golf ${Object.keys(golf[locale]).length} keys`);
}
```

Run: `node scratch/add-golf-messages.cjs` (file lives in the session scratchpad, not the repo; adjust the `file` path to absolute when running from there).

- [ ] **Step 6: List the new strings for native review** — append to `src/locales/NEEDS_NATIVE_REVIEW.md` a `## golf` section in the file's table format, one row per key in `golf.*` plus `landing.search.searchMode.golf` and `landing.journey.options.golfNote` (generate the rows from the four JSON files with a short node one-liner so they match exactly).

- [ ] **Step 7: Run the golf tests to see them pass, and commit**

Run: `npx vitest run src/features/golf` — Expected: PASS (api 3, locales 9).
```bash
git add src/features/golf src/locales
git commit -m "feat(golf): types, api client and messages for the golf catalogue"
```

---

## Task 8: Let a page ask the support widget to open (APP)

**Files:** Create `src/features/support/lib/supportWidget.store.ts`; modify `src/features/support/components/SupportWidget.tsx`, `SupportWidget.test.tsx`.

- [ ] **Step 1: Write the failing test** — add to `SupportWidget.test.tsx`: import `act` from `@testing-library/react` (extend the existing import) and `import { useSupportWidget } from '@/features/support/lib/supportWidget.store';`, then inside `describe('SupportWidget', …)`:

```tsx
    it('opens when another part of the page asks it to', async () => {
        api.fetchConversation.mockResolvedValue(null);
        renderWidget();
        expect(screen.getByRole('button', { name: /open support chat/i })).toBeInTheDocument();
        act(() => useSupportWidget.getState().requestOpen());
        expect(await screen.findByRole('button', { name: /close support chat/i })).toBeInTheDocument();
    });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/support/components/SupportWidget.test.tsx`
Expected: FAIL — cannot resolve `supportWidget.store`.

- [ ] **Step 3: Write the store and subscribe the widget**

```ts title="app:src/features/support/lib/supportWidget.store.ts"
import { create } from 'zustand';

/**
 * Lets a page outside the Support Chat ask for it to open: "Ask about tee times" on a golf course.
 *
 * The widget's open state lives in `useSupportChat`'s reducer, because opening also loads the
 * customer's conversation, and only the first time. So this carries a request rather than the
 * state: each `requestOpen()` bumps a counter, and the mounted widget answers it by opening itself.
 */
interface SupportWidgetRequests {
    openRequests: number;
    requestOpen:  () => void;
}

export const useSupportWidget = create<SupportWidgetRequests>((set) => ({
    openRequests: 0,
    requestOpen:  () => set((s) => ({ openRequests: s.openRequests + 1 })),
}));
```

In `SupportWidget.tsx`: add `import { useSupportWidget } from '@/features/support/lib/supportWidget.store';` and, directly after the `useSupportChat()` destructuring and **before** `if (!available) return null;`:

```tsx
    // A page asking for the chat (useSupportWidget). Requests made before this mounted are not
    // replayed: the widget is on every page, so there is no "before".
    const openRequests = useSupportWidget((s) => s.openRequests);
    const answered = useRef(openRequests);
    useEffect(() => {
        if (openRequests === answered.current) return;
        answered.current = openRequests;
        if (available && !panelOpen) void open();
    }, [openRequests, available, panelOpen, open]);
```
(`useEffect` and `useRef` are already imported in this file.)

- [ ] **Step 4: Run the widget's tests to see them pass**

Run: `npx vitest run src/features/support`
Expected: PASS, including the new test.

- [ ] **Step 5: Commit**

```bash
git add src/features/support
git commit -m "feat(support): a page can ask the support chat to open"
```

---

## Task 9: Ask about tee times (APP)

**Files:** Create `src/features/golf/components/ask-tee-times-button.tsx`; test `src/features/golf/__tests__/ask-tee-times-button.test.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx title="app:src/features/golf/__tests__/ask-tee-times-button.test.tsx"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';

const signedIn = (yes: boolean) =>
    useAuthStore.setState({ user: yes ? ({ id: 'u1', email: 'golfer@example.com' } as never) : null, isLoading: false });

beforeEach(() => {
    push.mockReset();
    useSupportWidget.setState({ openRequests: 0 });
    window.history.replaceState(null, '', '/golf/wack-wack');
});

describe('Ask about tee times', () => {
    it('asks the support chat to open for someone signed in', async () => {
        signedIn(true);
        renderWithIntl(<AskTeeTimesButton />);
        await userEvent.setup().click(screen.getByRole('button', { name: en.golf.askTeeTimes }));
        expect(useSupportWidget.getState().openRequests).toBe(1);
        expect(push).not.toHaveBeenCalled();
    });

    it('sends a signed-out visitor to sign in, and back here after', async () => {
        signedIn(false);
        renderWithIntl(<AskTeeTimesButton />);
        expect(screen.getByText(en.golf.askSignIn)).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole('button', { name: en.golf.askTeeTimes }));
        expect(push).toHaveBeenCalledWith('/login?redirect=%2Fgolf%2Fwack-wack');
        expect(useSupportWidget.getState().openRequests).toBe(0);
    });

    it('waits while it is still finding out who is signed in', () => {
        useAuthStore.setState({ user: null, isLoading: true });
        renderWithIntl(<AskTeeTimesButton />);
        expect(screen.getByRole('button', { name: en.golf.askTeeTimes })).toBeDisabled();
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/golf/__tests__/ask-tee-times-button.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Write the component**

```tsx title="app:src/features/golf/components/ask-tee-times-button.tsx"
'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';

/**
 * The golf course page's one action until tee-time booking is ported: open the support chat.
 *
 * The chat exists only for someone signed in (ADR-0032), so a signed-out visitor is sent to sign in
 * and brought back, the way checkout does it. Disabled while the session is still being read, so a
 * signed-in customer is not sent to the login page by a click that came too early.
 */
export function AskTeeTimesButton() {
    const t = useTranslations('golf');
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const checking = useAuthStore((s) => s.isLoading);
    const requestOpen = useSupportWidget((s) => s.requestOpen);

    const ask = () => {
        if (user) {
            requestOpen();
            return;
        }
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={ask}
                disabled={checking}
                className="inline-flex h-12 w-full items-center justify-center gap-2 bg-slate-900 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
                <MessageCircle size={16} aria-hidden />
                {t('askTeeTimes')}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {user || checking ? t('askHint') : t('askSignIn')}
            </p>
        </div>
    );
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/features/golf/__tests__/ask-tee-times-button.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/golf/components/ask-tee-times-button.tsx src/features/golf/__tests__/ask-tee-times-button.test.tsx
git commit -m "feat(golf): Ask about tee times opens the support chat"
```

---

## Task 10: The `/golf` list (APP)

**Files:** Create `src/features/golf/components/golf-course-card.tsx`, `golf-list-view.tsx`, `src/app/[locale]/golf/page.tsx`; test `src/features/golf/__tests__/golf-list-view.test.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx title="app:src/features/golf/__tests__/golf-list-view.test.tsx"
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import type { GolfCourse } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn(), fetchGolfCourse: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/shared/components/header', () => ({ Header: () => null }));
vi.mock('@/shared/components/footer', () => ({ Footer: () => null }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: vi.fn() }),
}));

import { GolfListView } from '@/features/golf/components/golf-list-view';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW', imageUrls: ['https://img.example/a.jpg'],
    amenities: [], status: 'published', createdAt: '', updatedAt: '', ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
});

describe('GolfListView', () => {
    it("asks in the viewer's currency and shows each course with its from-fee", async () => {
        api.fetchGolfCatalogue.mockResolvedValue({
            courses: [course(), course({ id: '2', slug: 'sky72', name: 'Sky72', greenFeeFrom: null })],
            countries: ['Philippines'],
        });
        renderWithIntl(<GolfListView />);

        const wack = await screen.findByRole('link', { name: /Wack Wack/ });
        expect(wack).toHaveAttribute('href', '/golf/wack-wack');
        expect(within(wack).getByText('Green fees from ₩120,000')).toBeInTheDocument();
        expect(within(screen.getByRole('link', { name: /Sky72/ })).queryByText(/Green fees from/)).toBeNull();
        expect(api.fetchGolfCatalogue).toHaveBeenCalledWith({ country: undefined, currency: 'KRW' });
    });

    it('offers the countries as links once there is more than one', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: ['Japan', 'Philippines'] });
        renderWithIntl(<GolfListView />);
        expect(await screen.findByRole('link', { name: 'Japan' })).toHaveAttribute('href', '/golf?country=Japan');
        expect(screen.getByRole('link', { name: en.golf.allCountries })).toHaveAttribute('href', '/golf');
    });

    it('says so when nothing is published', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: [] });
        renderWithIntl(<GolfListView />);
        expect(await screen.findByText(en.golf.emptyTitle)).toBeInTheDocument();
    });

    it('says which country is empty, and offers the rest', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: ['Japan'] });
        renderWithIntl(<GolfListView country="Philippines" />);
        expect(await screen.findByText('No courses in Philippines')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.seeAll })).toHaveAttribute('href', '/golf');
        expect(api.fetchGolfCatalogue).toHaveBeenCalledWith({ country: 'Philippines', currency: 'KRW' });
    });

    it('offers another try when the list fails to load', async () => {
        api.fetchGolfCatalogue
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ courses: [course()], countries: [] });
        renderWithIntl(<GolfListView />);
        await userEvent.setup().click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await screen.findByRole('link', { name: /Wack Wack/ })).toBeInTheDocument();
        expect(api.fetchGolfCatalogue).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/golf/__tests__/golf-list-view.test.tsx`
Expected: FAIL — cannot resolve `golf-list-view`.

- [ ] **Step 3: Write the card, the view and the page**

```tsx title="app:src/features/golf/components/golf-course-card.tsx"
import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/shared/lib/format';
import type { GolfCourse } from '@/features/golf/types';

/** One course in the `/golf` grid. The from-fee shows only when the course has one. */
export function GolfCourseCard({ course }: { course: GolfCourse }) {
    const t = useTranslations('golf');
    const cover = course.imageUrls[0];

    return (
        <Link
            href={`/golf/${course.slug}`}
            className="group block overflow-hidden border border-slate-200 bg-white transition-colors hover:border-slate-400 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/30"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-white/5">
                {cover ? (
                    // Admin-pasted URLs come from any host, which next/image would refuse.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-300 dark:text-white/20">
                        <Flag size={28} strokeWidth={1.5} aria-hidden />
                    </div>
                )}
            </div>
            <div className="space-y-1 p-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{course.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{course.city} · {course.country}</p>
                <div className="flex items-center justify-between gap-3 pt-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{t('holes', { holes: course.holes })}</span>
                    {course.greenFeeFrom != null && (
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {t('greenFeesFrom', { price: formatCurrency(course.greenFeeFrom, course.currency) })}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
```

```tsx title="app:src/features/golf/components/golf-list-view.tsx"
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCatalogue } from '@/features/golf/api/golf.api';
import { GolfCourseCard } from '@/features/golf/components/golf-course-card';
import type { GolfCatalogue } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalogue: GolfCatalogue };

/**
 * `/golf`: every published course, optionally in one country. Asked in the viewer's Display Currency
 * and asked again when it changes; the browser never converts a fee itself.
 */
export function GolfListView({ country }: { country?: string }) {
    const t = useTranslations('golf');
    const currency = useUserCurrency();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchGolfCatalogue({ country, currency })
            .then((catalogue) => { if (!cancelled) setState({ status: 'ready', catalogue }); })
            .catch(() => { if (!cancelled) setState({ status: 'error' }); });
        return () => { cancelled = true; };
    }, [country, currency, attempt]);

    const countries = state.status === 'ready' ? state.catalogue.countries : [];

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">{t('eyebrow')}</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('title')}</h1>
                <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>

                {(countries.length > 1 || country) && (
                    <nav aria-label={t('filterLabel')} className="mt-6 flex flex-wrap gap-2">
                        <CountryChip href="/golf" active={!country}>{t('allCountries')}</CountryChip>
                        {countries.map((c) => (
                            <CountryChip key={c} href={`/golf?country=${encodeURIComponent(c)}`} active={c === country}>{c}</CountryChip>
                        ))}
                    </nav>
                )}

                <div className="mt-8">
                    {state.status === 'loading' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] w-full" />)}
                        </div>
                    )}

                    {state.status === 'error' && (
                        <StateScreen
                            icon={AlertCircle}
                            title={t('errorTitle')}
                            lines={[t('errorBody')]}
                            actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{t('retry')}</button>}
                        />
                    )}

                    {state.status === 'ready' && state.catalogue.courses.length === 0 && (
                        <StateScreen
                            icon={Flag}
                            title={country ? t('emptyCountryTitle', { country }) : t('emptyTitle')}
                            lines={[country ? t('emptyCountryBody') : t('emptyBody')]}
                            actions={country ? <Link href="/golf" className={stateActionClass}>{t('seeAll')}</Link> : undefined}
                        />
                    )}

                    {state.status === 'ready' && state.catalogue.courses.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {state.catalogue.courses.map((c) => <GolfCourseCard key={c.id} course={c} />)}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}

function CountryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30',
            )}
        >
            {children}
        </Link>
    );
}
```

```tsx title="app:src/app/[locale]/golf/page.tsx"
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GolfListView } from '@/features/golf/components/golf-list-view';
import { hreflangAlternates } from '@/shared/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('golf');
    return {
        title:       t('metaTitle'),
        description: t('metaDescription'),
        alternates:  await hreflangAlternates('/golf'),
    };
}

/** The country filter is read here, on the server, so the view needs no Suspense for search params. */
export default async function GolfPage({ searchParams }: { searchParams: Promise<{ country?: string | string[] }> }) {
    const { country } = await searchParams;
    const only = typeof country === 'string' && country.trim() ? country.trim() : undefined;
    return <GolfListView country={only} />;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/features/golf/__tests__/golf-list-view.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/features/golf/components/golf-course-card.tsx" "src/features/golf/components/golf-list-view.tsx" "src/app/[locale]/golf/page.tsx" src/features/golf/__tests__/golf-list-view.test.tsx
git commit -m "feat(golf): /golf lists published courses, by country"
```

---

## Task 11: The course page (APP)

**Files:** Create `src/features/golf/components/golf-course-view.tsx`, `src/app/[locale]/golf/[slug]/page.tsx`; test `src/features/golf/__tests__/golf-course-view.test.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx title="app:src/features/golf/__tests__/golf-course-view.test.tsx"
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import { useAuthStore } from '@/shared/auth/store';
import type { GolfCourse } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn(), fetchGolfCourse: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/shared/components/header', () => ({ Header: () => null }));
vi.mock('@/shared/components/footer', () => ({ Footer: () => null }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: vi.fn() }),
}));

import { GolfCourseView } from '@/features/golf/components/golf-course-view';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: '1 Golf Rd',
    description: 'First paragraph.\n\nSecond paragraph.', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW',
    imageUrls: ['https://img.example/a.jpg', 'https://img.example/b.jpg'], amenities: ['caddie', 'night_golf'],
    status: 'published', createdAt: '', updatedAt: '', ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
    useAuthStore.setState({ user: null, isLoading: false });
});

describe('GolfCourseView', () => {
    it('lays out the course: facts, fee, amenities, paragraphs, address', async () => {
        api.fetchGolfCourse.mockResolvedValue(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);

        expect(await screen.findByRole('heading', { level: 1, name: 'Wack Wack' })).toBeInTheDocument();
        expect(screen.getByText('36 holes')).toBeInTheDocument();
        expect(screen.getByText('Par 72')).toBeInTheDocument();
        expect(screen.getByText('₩120,000')).toBeInTheDocument();
        expect(screen.getByText('Caddies')).toBeInTheDocument();
        expect(screen.getByText('Night golf')).toBeInTheDocument();
        expect(screen.getByText('First paragraph.')).toBeInTheDocument();
        expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
        expect(screen.getByText('1 Golf Rd')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.golf.askTeeTimes })).toBeInTheDocument();
        expect(api.fetchGolfCourse).toHaveBeenCalledWith('wack-wack', 'KRW');
    });

    it('leaves out what the course does not have', async () => {
        api.fetchGolfCourse.mockResolvedValue(course({ par: null, greenFeeFrom: null, amenities: [], address: null, description: '' }));
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await screen.findByRole('heading', { level: 1, name: 'Wack Wack' });
        expect(screen.queryByText(/^Par/)).toBeNull();
        expect(screen.queryByText(en.golf.fromLabel)).toBeNull();
        expect(screen.queryByText(en.golf.amenitiesTitle)).toBeNull();
        expect(screen.queryByText(en.golf.addressTitle)).toBeNull();
    });

    it('switches the large photo from the thumbnails', async () => {
        api.fetchGolfCourse.mockResolvedValue(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await userEvent.setup().click(await screen.findByRole('button', { name: 'Photo 2' }));
        expect(screen.getByRole('img', { name: 'Wack Wack' })).toHaveAttribute('src', 'https://img.example/b.jpg');
    });

    it('says the course is not available when there is no such course', async () => {
        api.fetchGolfCourse.mockRejectedValue(Object.assign(new Error('Golf course not found'), { status: 404 }));
        renderWithIntl(<GolfCourseView slug="gone" />);
        expect(await screen.findByText(en.golf.missingTitle)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.seeAll })).toHaveAttribute('href', '/golf');
    });

    it('offers another try on any other failure', async () => {
        api.fetchGolfCourse
            .mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }))
            .mockResolvedValueOnce(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await userEvent.setup().click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Wack Wack' })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/golf/__tests__/golf-course-view.test.tsx`
Expected: FAIL — cannot resolve `golf-course-view`.

- [ ] **Step 3: Write the view and the page**

```tsx title="app:src/features/golf/components/golf-course-view.tsx"
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { StateScreen, stateActionClass } from '@/shared/components/StateScreen';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCourse } from '@/features/golf/api/golf.api';
import { AskTeeTimesButton } from '@/features/golf/components/ask-tee-times-button';
import type { GolfCourse } from '@/features/golf/types';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; course: GolfCourse };

/** Paragraphs are separated by a blank line, as the admin form says. */
const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * `/golf/[slug]`: one course, its facts and photos, and the way to ask about playing it. Fetched in
 * the viewer's Display Currency and again when that changes. An unknown or draft slug is already a
 * 404 from the server page; `missing` here covers a course unpublished while the page was open.
 */
export function GolfCourseView({ slug }: { slug: string }) {
    const t = useTranslations('golf');
    const tAll = useTranslations();
    const currency = useUserCurrency();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchGolfCourse(slug, currency)
            .then((course) => { if (!cancelled) setState({ status: 'ready', course }); })
            .catch((err: { status?: number }) => {
                if (!cancelled) setState({ status: err?.status === 404 ? 'missing' : 'error' });
            });
        return () => { cancelled = true; };
    }, [slug, currency, attempt]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8">
                {state.status === 'loading' && (
                    <div className="space-y-4">
                        <Skeleton className="aspect-[16/9] w-full" />
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                    </div>
                )}

                {state.status === 'missing' && (
                    <StateScreen
                        icon={Flag}
                        title={t('missingTitle')}
                        lines={[t('missingBody')]}
                        actions={<Link href="/golf" className={stateActionClass}>{t('seeAll')}</Link>}
                    />
                )}

                {state.status === 'error' && (
                    <StateScreen
                        icon={AlertCircle}
                        title={t('errorTitle')}
                        lines={[t('errorBody')]}
                        actions={<button type="button" className={stateActionClass} onClick={() => setAttempt((a) => a + 1)}>{t('retry')}</button>}
                    />
                )}

                {state.status === 'ready' && (() => {
                    const c = state.course;
                    const cover = c.imageUrls[Math.min(shown, c.imageUrls.length - 1)];
                    const text = paragraphs(c.description);
                    return (
                        <>
                            <nav className="mb-6 text-xs text-slate-400 dark:text-slate-500">
                                <Link href="/" className="transition-colors hover:text-blue-500">{tAll('property.breadcrumbHome')}</Link>
                                <span className="mx-1.5">›</span>
                                <Link href="/golf" className="transition-colors hover:text-blue-500">{t('breadcrumb')}</Link>
                                <span className="mx-1.5">›</span>
                                <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                            </nav>

                            {cover && (
                                <div className="space-y-2">
                                    <div className="aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- admin URLs come from any host */}
                                        <img src={cover} alt={c.name} className="h-full w-full object-cover" />
                                    </div>
                                    {c.imageUrls.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto">
                                            {c.imageUrls.map((url, i) => (
                                                <button
                                                    key={url}
                                                    type="button"
                                                    aria-label={t('photo', { n: i + 1 })}
                                                    aria-pressed={i === shown}
                                                    onClick={() => setShown(i)}
                                                    className={cn(
                                                        'h-16 w-24 shrink-0 overflow-hidden border-2 transition-opacity',
                                                        i === shown ? 'border-slate-900 dark:border-white' : 'border-transparent opacity-70 hover:opacity-100',
                                                    )}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
                                <div className="space-y-8">
                                    <header>
                                        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{c.name}</h1>
                                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                            <MapPin size={14} aria-hidden /> {c.city} · {c.country}
                                        </p>
                                        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                                            <li className="border border-slate-200 px-2.5 py-1 text-slate-700 dark:border-white/10 dark:text-slate-200">{t('holes', { holes: c.holes })}</li>
                                            {c.par != null && (
                                                <li className="border border-slate-200 px-2.5 py-1 text-slate-700 dark:border-white/10 dark:text-slate-200">{t('par', { par: c.par })}</li>
                                            )}
                                        </ul>
                                    </header>

                                    {c.amenities.length > 0 && (
                                        <section>
                                            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t('amenitiesTitle')}</h2>
                                            <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-3 dark:text-slate-300">
                                                {c.amenities.map((a) => <li key={a}>{t(`amenities.${a}`)}</li>)}
                                            </ul>
                                        </section>
                                    )}

                                    {text.length > 0 && (
                                        <section>
                                            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t('aboutTitle')}</h2>
                                            <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                                {text.map((p, i) => <p key={i}>{p}</p>)}
                                            </div>
                                        </section>
                                    )}

                                    {c.address && (
                                        <section>
                                            <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('addressTitle')}</h2>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{c.address}</p>
                                        </section>
                                    )}
                                </div>

                                <aside className="h-fit space-y-4 border border-slate-200 bg-white p-5 lg:sticky lg:top-24 dark:border-white/10 dark:bg-slate-900">
                                    {c.greenFeeFrom != null && (
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('fromLabel')}</p>
                                            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{formatCurrency(c.greenFeeFrom, c.currency)}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('guidePrice')}</p>
                                        </div>
                                    )}
                                    <AskTeeTimesButton />
                                </aside>
                            </div>
                        </>
                    );
                })()}
            </main>
            <Footer />
        </div>
    );
}
```

```tsx title="app:src/app/[locale]/golf/[slug]/page.tsx"
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GolfCourseView } from '@/features/golf/components/golf-course-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * The course's name for the tab, or `missing` when api-v2 says no published course has this slug.
 * An outage is neither: the page renders and the view says what went wrong. Not cached, so a course
 * published a moment ago is not a 404 for anyone.
 */
async function lookUp(slug: string): Promise<{ name: string } | 'missing' | null> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    try {
        const res = await fetch(`${base}/golf/courses/${encodeURIComponent(slug)}`, {
            signal: AbortSignal.timeout(4000),
            cache:  'no-store',
        });
        if (res.status === 404) return 'missing';
        if (!res.ok) return null;
        const body = await res.json() as { data?: { name?: string } };
        return body.data?.name ? { name: body.data.name } : null;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const [found, t] = await Promise.all([lookUp(slug), getTranslations('golf')]);
    return {
        title:      found && found !== 'missing' ? t('courseMetaTitle', { name: found.name }) : t('metaTitle'),
        alternates: await hreflangAlternates(`/golf/${slug}`),
    };
}

export default async function GolfCoursePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (await lookUp(slug) === 'missing') notFound();
    return <GolfCourseView slug={slug} />;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/features/golf/__tests__/golf-course-view.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/features/golf/components/golf-course-view.tsx" "src/app/[locale]/golf/[slug]/page.tsx" src/features/golf/__tests__/golf-course-view.test.tsx
git commit -m "feat(golf): the course page, with Ask about tee times"
```

---

## Task 12: The admin screen (APP)

**Files:** Create `src/features/admin/components/golf-course-form.tsx`, `golf-courses-view.tsx`, `golf-course-form.test.tsx`, `src/app/admin/(dashboard)/golf/page.tsx`; modify `src/features/admin/components/admin-sidebar.tsx`, `src/app/admin/layout.tsx`.

- [ ] **Step 1: Write the failing form test**

```tsx title="app:src/features/admin/components/golf-course-form.test.tsx"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { GolfCourseForm } from '@/features/admin/components/golf-course-form';
import type { GolfCourse } from '@/features/golf/types';

const existing: GolfCourse = {
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: ['cart'],
    status: 'draft', createdAt: '', updatedAt: '',
};

const form = (props: Partial<React.ComponentProps<typeof GolfCourseForm>> = {}) =>
    renderWithIntl(<GolfCourseForm saving={false} errors={{}} onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);

describe('GolfCourseForm', () => {
    it('makes the slug from name and city until someone types their own', async () => {
        const user = userEvent.setup();
        form();
        await user.type(screen.getByLabelText('Name *'), 'Wack Wack');
        await user.type(screen.getByLabelText('City *'), 'Mandaluyong');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-wack-mandaluyong');

        await user.clear(screen.getByLabelText('Slug'));
        await user.type(screen.getByLabelText('Slug'), 'wack-east');
        await user.type(screen.getByLabelText('Name *'), ' East');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-east');
    });

    it("leaves an existing course's slug alone: its links already use it", async () => {
        const user = userEvent.setup();
        form({ course: existing });
        await user.type(screen.getByLabelText('Name *'), ' Golf');
        expect(screen.getByLabelText('Slug')).toHaveValue('wack-wack');
    });

    it('sends what the API expects', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        form({ onSubmit });
        await user.type(screen.getByLabelText('Name *'), 'Sky72');
        await user.type(screen.getByLabelText('City *'), 'Incheon');
        await user.type(screen.getByLabelText('Country *'), 'South Korea');
        await user.selectOptions(screen.getByLabelText('Holes *'), '27');
        await user.type(screen.getByLabelText('Par'), '108');
        await user.type(screen.getByLabelText('Green fee from'), '150000');
        await user.clear(screen.getByLabelText('Currency'));
        await user.type(screen.getByLabelText('Currency'), 'krw');
        await user.type(screen.getByLabelText(/Image URLs/), 'https://a.example/1.jpg{Enter}{Enter} https://a.example/2.jpg ');
        await user.click(screen.getByLabelText('Caddies'));
        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(onSubmit).toHaveBeenCalledWith({
            slug: 'sky72-incheon', name: 'Sky72', country: 'South Korea', city: 'Incheon', address: null,
            description: '', holes: 27, par: 108, greenFeeFrom: 150000, currency: 'KRW',
            imageUrls: ['https://a.example/1.jpg', 'https://a.example/2.jpg'], amenities: ['caddie'],
        });
    });

    it("shows the server's complaint beside the field it is about", () => {
        form({ errors: { slug: ['Another golf course already uses the slug "sky72".'] } });
        expect(screen.getByText('Another golf course already uses the slug "sky72".')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/admin/components/golf-course-form.test.tsx`
Expected: FAIL — cannot resolve `golf-course-form`.

- [ ] **Step 3: Write the form**

```tsx title="app:src/features/admin/components/golf-course-form.tsx"
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { slugify } from '@/features/golf/lib/slugify';
import { GOLF_AMENITIES, GOLF_HOLES, type GolfAmenity, type GolfCourse, type GolfCourseDraft } from '@/features/golf/types';

/** api-v2's refusals, by field: a 422's `details`, or a 409's for a taken slug. */
export type FieldErrors = Partial<Record<keyof GolfCourseDraft, string[]>>;

interface Props {
    /** The course being edited; absent for a new one. */
    course?:  GolfCourse;
    saving:   boolean;
    errors:   FieldErrors;
    onSubmit: (draft: GolfCourseDraft) => void;
    onCancel: () => void;
}

interface FormState {
    name: string; country: string; city: string; slug: string; address: string; description: string;
    holes: string; par: string; greenFeeFrom: string; currency: string; imageUrls: string; amenities: GolfAmenity[];
}

const fromCourse = (c?: GolfCourse): FormState => ({
    name:         c?.name ?? '',
    country:      c?.country ?? '',
    city:         c?.city ?? '',
    slug:         c?.slug ?? '',
    address:      c?.address ?? '',
    description:  c?.description ?? '',
    holes:        String(c?.holes ?? 18),
    par:          c?.par != null ? String(c.par) : '',
    greenFeeFrom: c?.greenFeeFrom != null ? String(c.greenFeeFrom) : '',
    currency:     c?.currency ?? 'USD',
    imageUrls:    (c?.imageUrls ?? []).join('\n'),
    amenities:    c?.amenities ?? [],
});

/** The form's strings as api-v2 takes them. It checks everything again; this only shapes it. */
const toDraft = (f: FormState): GolfCourseDraft => ({
    slug:         f.slug.trim(),
    name:         f.name.trim(),
    country:      f.country.trim(),
    city:         f.city.trim(),
    address:      f.address.trim() || null,
    description:  f.description.trim(),
    holes:        Number(f.holes),
    par:          f.par.trim() ? Number(f.par) : null,
    greenFeeFrom: f.greenFeeFrom.trim() ? Number(f.greenFeeFrom) : null,
    currency:     f.currency.trim().toUpperCase(),
    imageUrls:    f.imageUrls.split('\n').map((u) => u.trim()).filter(Boolean),
    amenities:    f.amenities,
});

const boxClass   = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:border-blue-500 focus-visible:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400/80';
const errorClass = 'ml-1 text-[10px] font-bold text-rose-500';

/** Create or edit one golf course. English only: it is a staff screen. */
export function GolfCourseForm({ course, saving, errors, onSubmit, onCancel }: Props) {
    const amenityLabel = useTranslations('golf.amenities');
    const [form, setForm] = useState<FormState>(() => fromCourse(course));
    // A new course's slug follows its name and city until someone types one. An existing course
    // keeps the slug its links already use.
    const [slugTyped, setSlugTyped] = useState(Boolean(course));

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => {
            const next = { ...f, [key]: value };
            if (!slugTyped && (key === 'name' || key === 'city')) next.slug = slugify(next.name, next.city);
            return next;
        });

    const error = (key: keyof GolfCourseDraft) => errors[key]?.[0];

    const toggle = (a: GolfAmenity) =>
        set('amenities', form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);

    return (
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(toDraft(form)); }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input id="golf-name" label="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} error={error('name')} />
                <Input
                    id="golf-slug" label="Slug" placeholder="made from the name and city" value={form.slug}
                    onChange={(e) => { setSlugTyped(true); set('slug', e.target.value); }} error={error('slug')}
                />
                <Input id="golf-city" label="City *" value={form.city} onChange={(e) => set('city', e.target.value)} error={error('city')} />
                <Input id="golf-country" label="Country *" value={form.country} onChange={(e) => set('country', e.target.value)} error={error('country')} />
                <Input id="golf-address" label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} error={error('address')} />
                <div className="space-y-1.5">
                    <label htmlFor="golf-holes" className={labelClass}>Holes *</label>
                    <select id="golf-holes" value={form.holes} onChange={(e) => set('holes', e.target.value)} className={`${boxClass} h-11`}>
                        {GOLF_HOLES.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {error('holes') && <p className={errorClass}>{error('holes')}</p>}
                </div>
                <Input id="golf-par" label="Par" type="number" value={form.par} onChange={(e) => set('par', e.target.value)} error={error('par')} />
                <Input
                    id="golf-fee" label="Green fee from" type="number" min="0" step="0.01" value={form.greenFeeFrom}
                    onChange={(e) => set('greenFeeFrom', e.target.value)} error={error('greenFeeFrom')}
                />
                <Input id="golf-currency" label="Currency" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value)} error={error('currency')} />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="golf-images" className={labelClass}>Image URLs — one per line, the first is the cover</label>
                <textarea id="golf-images" rows={3} value={form.imageUrls} onChange={(e) => set('imageUrls', e.target.value)} className={boxClass} />
                {error('imageUrls') && <p className={errorClass}>{error('imageUrls')}</p>}
            </div>

            <div className="space-y-1.5">
                <label htmlFor="golf-description" className={labelClass}>Description — a blank line starts a new paragraph</label>
                <textarea id="golf-description" rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} className={boxClass} />
                {error('description') && <p className={errorClass}>{error('description')}</p>}
            </div>

            <fieldset className="space-y-2">
                <legend className={labelClass}>Amenities</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {GOLF_AMENITIES.map((a) => (
                        <label key={a} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggle(a)} />
                            {amenityLabel(a)}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                <Button type="submit" size="sm" isLoading={saving}>{course ? 'Save' : 'Create'}</Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/features/admin/components/golf-course-form.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the list screen and its page, add the namespace and the sidebar entry**

```tsx title="app:src/features/admin/components/golf-courses-view.tsx"
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { adminGolfApi } from '@/features/golf/api/golf.api';
import type { GolfCourse, GolfCourseDraft } from '@/features/golf/types';
import { GolfCourseForm, type FieldErrors } from '@/features/admin/components/golf-course-form';

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/**
 * The golf catalogue's back office (api-v2 `/admin/golf`). There is no supplier, so this is the one
 * place a course is written, and it reaches the storefront only when published.
 */
export function GolfCoursesView() {
    const [courses, setCourses]       = useState<GolfCourse[]>([]);
    const [total, setTotal]           = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage]             = useState(1);
    const [search, setSearch]         = useState('');
    const [query, setQuery]           = useState('');
    const [loading, setLoading]       = useState(true);
    const [loadError, setLoadError]   = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId]         = useState<string | null>(null);

    const [editing, setEditing]       = useState<GolfCourse | 'new' | null>(null);
    const [saving, setSaving]         = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError]   = useState<string | null>(null);

    const load = useCallback(async (p: number, q: string) => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await adminGolfApi.list(p, q || undefined);
            setCourses(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        } catch (err) {
            setLoadError(message(err, 'Failed to load golf courses.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(page, query); }, [page, query, load]);

    const openEditor = (target: GolfCourse | 'new') => {
        setEditing(target);
        setFieldErrors({});
        setFormError(null);
    };

    async function save(draft: GolfCourseDraft) {
        if (!editing) return;
        setSaving(true);
        setFieldErrors({});
        setFormError(null);
        try {
            if (editing === 'new') await adminGolfApi.create(draft);
            else await adminGolfApi.update(editing.id, draft);
            setEditing(null);
            await load(page, query);
        } catch (err) {
            // The dialog stays open with what was typed; the refusal goes beside its field.
            setFieldErrors((err as { body?: { details?: FieldErrors } }).body?.details ?? {});
            setFormError(message(err, 'Save failed.'));
        } finally {
            setSaving(false);
        }
    }

    async function act(course: GolfCourse, action: () => Promise<unknown>) {
        setBusyId(course.id);
        setActionError(null);
        try {
            await action();
            await load(page, query);
        } catch (err) {
            setActionError(message(err, 'That did not work.'));
        } finally {
            setBusyId(null);
        }
    }

    const toggleStatus = (c: GolfCourse) =>
        act(c, () => adminGolfApi.setStatus(c.id, c.status === 'published' ? 'draft' : 'published'));

    const remove = (c: GolfCourse) => {
        if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
        void act(c, () => adminGolfApi.remove(c.id));
    };

    return (
        <div className="space-y-3.5 px-5 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-base font-semibold text-slate-900">Golf Courses</h1>
                    <p className="mt-0.5 text-xs text-slate-500">{total > 0 ? `${total.toLocaleString()} total` : 'Courses the storefront can show'}</p>
                </div>
                <Button size="sm" onClick={() => openEditor('new')}><Plus size={14} /> Add course</Button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }} className="flex max-w-md items-end gap-2">
                <Input id="golf-search" icon={Search} placeholder="Search name, city or country…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" size="sm" className="shrink-0">Search</Button>
                {query && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>Clear</Button>}
            </form>

            {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {loadError ? (
                    <div className="p-8 text-center text-sm text-rose-500">{loadError}</div>
                ) : loading ? (
                    <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : courses.length === 0 ? (
                    <div className="p-16 text-center">
                        <Flag size={36} className="mx-auto mb-3 text-slate-200" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">{query ? 'No courses match' : 'No golf courses yet'}</p>
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full text-[13px]">
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                                <tr>
                                    {['Course', 'Location', 'Holes', 'From', 'Status'].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                                    ))}
                                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {courses.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-1.5">
                                            <div className="flex items-center gap-3">
                                                {c.imageUrls[0] ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={c.imageUrls[0]} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Flag size={14} className="text-slate-400" /></div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-900">{c.name}</p>
                                                    <p className="text-[11px] text-slate-400">/golf/{c.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.city}, {c.country}</td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.holes}</td>
                                        <td className="px-3 py-1.5 text-slate-600">{c.greenFeeFrom != null ? `${c.currency} ${c.greenFeeFrom.toLocaleString()}` : '—'}</td>
                                        <td className="px-3 py-1.5">
                                            <Badge variant={c.status === 'published' ? 'success' : 'secondary'}>{c.status}</Badge>
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost" size="sm" disabled={busyId === c.id} onClick={() => toggleStatus(c)}
                                                    aria-label={c.status === 'published' ? `Unpublish ${c.name}` : `Publish ${c.name}`}
                                                    className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                                                >
                                                    {c.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </Button>
                                                <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => openEditor(c)} className="h-8 px-2 text-blue-600 hover:bg-blue-50"><Pencil size={14} /></Button>
                                                <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} disabled={busyId === c.id} onClick={() => remove(c)} className="h-8 px-2 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!loading && !loadError && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft size={14} />}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight size={14} />}>Next</Button>
                    </div>
                </div>
            )}

            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-lg">{editing === 'new' ? 'New golf course' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
                    </DialogHeader>
                    {formError && <p role="alert" className="mb-3 text-sm text-rose-600">{formError}</p>}
                    {editing && (
                        <GolfCourseForm
                            key={editing === 'new' ? 'new' : editing.id}
                            course={editing === 'new' ? undefined : editing}
                            saving={saving}
                            errors={fieldErrors}
                            onSubmit={save}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
```

```tsx title="app:src/app/admin/(dashboard)/golf/page.tsx"
import { GolfCoursesView } from '@/features/admin/components/golf-courses-view';

export default function AdminGolfPage() {
    return <GolfCoursesView />;
}
```

In `src/app/admin/layout.tsx`: change `import { common, support } from '@/locales/en.json';` to `import { common, support, golf } from '@/locales/en.json';` and `messages={{ common, support }}` to `messages={{ common, support, golf }}`.

In `src/features/admin/components/admin-sidebar.tsx`: add `Flag,` to the lucide import list, and after the Destinations item add
`{ href: '/admin/golf',         label: 'Golf Courses', icon: Flag },`.

- [ ] **Step 6: Run the admin tests and commit**

Run: `npx vitest run src/features/admin src/app/admin` — Expected: PASS (the form's 4 plus the existing ones).
```bash
git add src/features/admin/components/golf-course-form.tsx src/features/admin/components/golf-course-form.test.tsx src/features/admin/components/golf-courses-view.tsx "src/app/admin/(dashboard)/golf/page.tsx" src/app/admin/layout.tsx src/features/admin/components/admin-sidebar.tsx
git commit -m "feat(golf): admins create, edit, publish and delete golf courses"
```

---

## Task 13: Entry points (APP)

**Files:** Modify `src/features/landing/journey/Journey.tsx`, `Journey.i18n.test.tsx`, `src/features/search/components/immersive-search-bar.tsx`, `immersive-search-bar.test.tsx`.

- [ ] **Step 1: Write the failing tests**

In `Journey.i18n.test.tsx`, inside `it('translates the closing cards, Golf included', …)`, replace
`expect(screen.getByText(J_KO.options.golf)).toBeInTheDocument();` with:
```tsx
        const golf = screen.getByRole('link', { name: new RegExp(J_KO.options.golf) });
        expect(golf).toHaveAttribute('href', '/golf');
```

In `immersive-search-bar.test.tsx`, change the navigation mock to
```tsx
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ push }),
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
```
and add a describe block at the end:
```tsx
describe('ImmersiveSearchBar — golf', () => {
    it('links to golf from a third tab, which is not a search mode', () => {
        const onModeSelect = vi.fn();
        renderWithIntl(<ImmersiveSearchBar onModeSelect={onModeSelect} />);
        expect(screen.getByRole('link', { name: 'Golf' })).toHaveAttribute('href', '/golf');
        expect(screen.queryByRole('button', { name: 'Golf' })).toBeNull();
        expect(onModeSelect).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/landing/journey src/features/search/components/immersive-search-bar.test.tsx`
Expected: FAIL — no Golf link in either.

- [ ] **Step 3: Make the Journey card a link** — in `Journey.tsx` `OptionsPanel`, replace the comment and options array with:
```tsx
    const options: Array<{ href: string; label: string; note: string }> = [
        { href: '/search', label: tAll('landing.search.searchMode.stays'), note: tAll('landing.journey.options.staysNote') },
        { href: '/flights/search', label: tAll('landing.search.searchMode.flights'), note: tAll('landing.journey.options.flightsNote') },
        { href: '/golf', label: tAll('landing.journey.options.golf'), note: tAll('landing.journey.options.golfNote') },
    ];
```
and, since every card now has somewhere to go, replace the `return o.href ? ( <Link …>{body}</Link> ) : ( <div …>{body}</div> );` expression with just the `<Link …>` branch:
```tsx
                return (
                    <Link
                        key={o.label}
                        href={o.href}
                        className={`${card} transition-[filter] duration-150 hover:brightness-125`}
                        style={glass}
                    >
                        {body}
                    </Link>
                );
```

- [ ] **Step 4: Add the search bar tab** — in `immersive-search-bar.tsx`, change `import { useRouter } from '@/i18n/navigation';` to `import { Link, useRouter } from '@/i18n/navigation';`, and inside the mode tabs `div`, after the `{(['stays', 'flights'] as Mode[]).map(…)}` block, add:
```tsx
                            {/* Golf has no search form yet, so its tab is a way to the catalogue rather than a mode. */}
                            <Link
                                href="/golf"
                                style={{
                                    padding: '7px 16px', borderRadius: '100px', textDecoration: 'none',
                                    fontSize: '12px', fontWeight: 700, letterSpacing: '.04em',
                                    fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,.85)',
                                    display: 'inline-flex', alignItems: 'center', transition: 'color .2s',
                                }}
                            >{tAll('landing.search.searchMode.golf')}</Link>
```

- [ ] **Step 5: Run them to see them pass, and commit**

Run: `npx vitest run src/features/landing src/features/search`
Expected: PASS.
```bash
git add src/features/landing/journey src/features/search/components
git commit -m "feat(golf): the Journey's Golf card and a Golf tab in the search bar lead to /golf"
```

---

## Task 14: Verify

- [ ] **Step 1: Full suites, types and lint, against Task 0's baselines**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby && npx vitest run 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | tail -3 && npx eslint src --ext .ts 2>&1 | tail -3
cd /c/Users/USER/Documents/GitHub/cheapestgo-app-v2-nearby && npx vitest run 2>&1 | tail -8 && npx tsc --noEmit 2>&1 | grep -c "error TS" && npx eslint src/features/golf src/features/admin/components/golf-course*.tsx "src/app/[locale]/golf" 2>&1 | tail -5
```
Expected: every count equal to its baseline plus the new passing tests; no new type errors or lint errors in touched files.

- [ ] **Step 2: Manual check in the running app** — API (`npm run dev`) and app (`npm run dev`) both against 5434: create a course in `/admin/golf` with two image URLs, publish it, open `/golf` and `/ko/golf`, open the course page, switch the currency selector (the fee changes, labelled in the new currency), click Ask about tee times signed out (login with redirect) and signed in (chat opens), check light and dark, and a 360px-wide viewport (the search bar's three tabs fit). Unpublish it and confirm `/golf/<slug>` is a 404.

- [ ] **Step 3: Record what was verified** in the final message: test counts, any baseline failures that are not this work's, and anything that could not be checked.
