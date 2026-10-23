import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    JOURNEY_SCREENS,
    SHOWCASE_DESTINATIONS,
    STAGES,
    currentStage,
    hasWritten,
    ramp,
    stageProgress,
    groundLayers,
    HERO_GROUND,
    journeyBeats,
    sequenceOpacity,
    type Stage,
} from '@/features/landing/journey/stages';
import { fetchActStays } from '@/features/landing/api/featured.api';

/**
 * The Journey's timing spine. Every visible layer — showcase, docked search, Boarding
 * Pass — positions itself from these, so an error here moves all of them at once and in
 * ways that look like a styling bug rather than a maths one.
 */

describe('ramp', () => {
    it('is 0 before the window and 1 after it', () => {
        expect(ramp(0.0, 0.2, 0.4)).toBe(0);
        expect(ramp(0.9, 0.2, 0.4)).toBe(1);
    });

    it('is linear across the window', () => {
        expect(ramp(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    });

    it('does not divide by zero on a zero-width window', () => {
        expect(ramp(0.5, 0.3, 0.3)).toBe(1);
        expect(ramp(0.1, 0.3, 0.3)).toBe(0);
        expect(Number.isNaN(ramp(0.3, 0.3, 0.3))).toBe(false);
    });
});

describe('stageProgress', () => {
    const stage = STAGES[0];

    it('is null outside the stage, so nothing of that stage renders', () => {
        expect(stageProgress(stage, stage.from - 0.01)).toBeNull();
        expect(stageProgress(stage, stage.to + 0.01)).toBeNull();
    });

    it('runs 0 → 1 across the stage', () => {
        expect(stageProgress(stage, stage.from)).toBe(0);
        expect(stageProgress(stage, stage.to)).toBe(1);
        expect(stageProgress(stage, (stage.from + stage.to) / 2)).toBeCloseTo(0.5);
    });
});

describe('STAGES', () => {
    it('is the product, in the order it is introduced', () => {
        expect(STAGES.map(s => s.id)).toEqual(['stays', 'flights', 'ai', 'options']);
    });

    it('never overlaps — two docked searches at once would fight over the store', () => {
        for (let i = 1; i < STAGES.length; i++) {
            expect(STAGES[i].from).toBeGreaterThan(STAGES[i - 1].to);
        }
    });

    it('leaves the hero room before the first stage', () => {
        expect(STAGES[0].from).toBeGreaterThanOrEqual(0.1);
    });

    /**
     * The regression that put a stage panel on top of the search form.
     *
     * The section below the track enters the viewport one full viewport before the track
     * ends. A stage still docked at that point is on screen at the same time as the form,
     * and the two render over each other. The last viewport of the track is therefore
     * reserved: no stage may run into it, and the exit fade owns it.
     */
    it('ends every stage before the section below enters the viewport', () => {
        const sectionEnters = (JOURNEY_SCREENS - 1) / JOURNEY_SCREENS;
        for (const s of STAGES) {
            expect(s.to).toBeLessThanOrEqual(sectionEnters);
        }
    });

    it('leaves the last viewport of the track as room to exit in', () => {
        const last = STAGES[STAGES.length - 1].to;
        const tail = 1 - last;
        // At least most of a viewport of pure fade-out, with nothing docked.
        expect(tail).toBeGreaterThanOrEqual(1 / JOURNEY_SCREENS * 0.9);
    });

    it('keeps every span inside the track and numbered in order', () => {
        expect(JOURNEY_SCREENS).toBeGreaterThan(1);
        STAGES.forEach((s, i) => {
            expect(s.from).toBeGreaterThanOrEqual(0);
            expect(s.to).toBeLessThanOrEqual(1);
            expect(s.to).toBeGreaterThan(s.from);
            expect(s.index).toBe(i + 1);
        });
    });
});

describe('currentStage', () => {
    it('finds the stage the visitor is inside', () => {
        expect(currentStage(STAGES[1].from + 0.01)?.id).toBe('flights');
    });

    it('is null in the gap between stages, and at the very top', () => {
        expect(currentStage(0)).toBeNull();
        const gap = (STAGES[0].to + STAGES[1].from) / 2;
        expect(currentStage(gap)).toBeNull();
    });
});

describe('hasWritten', () => {
    const stage = STAGES[0];

    it('holds the Pass Line until the stage is half crossed', () => {
        // Appearing the instant a stage docks reads as pre-filled; landing while the
        // visitor is looking at the stage reads as the page answering them.
        expect(hasWritten(stage, stage.from)).toBe(false);
        expect(hasWritten(stage, (stage.from + stage.to) / 2)).toBe(true);
    });

    it('stays written once the stage is behind you', () => {
        expect(hasWritten(stage, 1)).toBe(true);
    });

    it('writes the lines in stage order, never ahead of the descent', () => {
        const mid = (STAGES[1].from + STAGES[1].to) / 2;
        expect(hasWritten(STAGES[0], mid)).toBe(true);   // already passed
        expect(hasWritten(STAGES[1], mid)).toBe(true);   // being crossed
        expect(hasWritten(STAGES[2], mid)).toBe(false);  // not reached
    });
});

describe('SHOWCASE_DESTINATIONS', () => {
    it('names real places with the country the deal lookup needs', () => {
        expect(SHOWCASE_DESTINATIONS.length).toBeGreaterThan(1);
        for (const d of SHOWCASE_DESTINATIONS) {
            expect(d.city).toBeTruthy();
            expect(d.countryCode).toMatch(/^[A-Z]{2}$/);
            expect(d.src).toMatch(/^\/images\/destinations\/.+\.(webp|jpg)$/);
        }
    });
});

/**
 * The promoted-stay fetch. Its job is to never be the reason a landing page fails: every
 * fault resolves to "no price for that destination", because the strip runs without one.
 */
describe('fetchActStays', () => {
    const STAY = { name: 'Myeongdong Stay', price: 4200, currency: 'PHP', images: [] };
    const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    });

    it('returns nothing when no API base is configured, rather than throwing', async () => {
        delete process.env.NEXT_PUBLIC_API_URL;
        expect(await fetchActStays(SHOWCASE_DESTINATIONS)).toEqual({});
    });

    it('keys stays by city so the strip can look up what is on screen', async () => {
        process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api/v2';
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ stay: STAY }) })));

        const out = await fetchActStays([SHOWCASE_DESTINATIONS[0]]);
        expect(Object.keys(out)).toEqual(['Seoul']);
        expect(out.Seoul.name).toBe('Myeongdong Stay');
    });

    it('drops a stay with no price — the strip may not quote nothing', async () => {
        process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api/v2';
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ stay: { ...STAY, price: 0 } }) })));
        expect(await fetchActStays([SHOWCASE_DESTINATIONS[0]])).toEqual({});
    });

    it('survives a rejected request, a non-ok response and a null stay', async () => {
        process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api/v2';

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
        expect(await fetchActStays([SHOWCASE_DESTINATIONS[0]])).toEqual({});

        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
        expect(await fetchActStays([SHOWCASE_DESTINATIONS[0]])).toEqual({});

        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ stay: null }) })));
        expect(await fetchActStays([SHOWCASE_DESTINATIONS[0]])).toEqual({});
    });

    it('one failing destination does not cost the others their price', async () => {
        process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api/v2';
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (String(url).includes('Tokyo')) throw new Error('down');
                return { ok: true, json: async () => ({ stay: STAY }) };
            }),
        );

        const out = await fetchActStays(SHOWCASE_DESTINATIONS);
        expect(Object.keys(out).sort()).toEqual(['Bali', 'Boracay', 'Seoul']);
    });
});

describe('stage sides and grounds', () => {
    it('alternates sides — every stage on one side reads as a list, not a journey', () => {
        const sided = STAGES.filter(s => s.side !== 'center');
        for (let i = 1; i < sided.length; i++) {
            expect(sided[i].side).not.toBe(sided[i - 1].side);
        }
    });

    it('ends centred, because the last stage is a choice rather than a pitch', () => {
        expect(STAGES[STAGES.length - 1].side).toBe('center');
    });

    it('gives every stage its own ground, so the descent changes temperature', () => {
        const grounds = STAGES.map(s => s.ground);
        expect(new Set(grounds).size).toBe(STAGES.length);
        for (const g of grounds) expect(g).toMatch(/gradient\(/);
    });
});

/**
 * The ground blend. This is the bug that made every stage render black: fading each
 * stage's ground in and out independently never summed to 1, so the near-black base
 * always showed through whatever colour the stage had been given.
 */
describe('groundLayers', () => {
    it('is always fully opaque — no stage may fall through to the base', () => {
        for (let j = 0; j <= 1.0001; j += 0.02) {
            const { base, overlay, overlayOpacity } = groundLayers(j);
            expect(base).toBeTruthy();
            expect(overlay).toBeTruthy();
            expect(overlayOpacity).toBeGreaterThanOrEqual(0);
            expect(overlayOpacity).toBeLessThanOrEqual(1);
        }
    });

    it('stands on a stage\'s own ground at that stage\'s midpoint', () => {
        for (const s of STAGES) {
            const mid = (s.from + s.to) / 2;
            const { base, overlay, overlayOpacity } = groundLayers(mid);
            // Either it IS the base, or the overlay has fully arrived.
            const painted = overlayOpacity >= 0.999 ? overlay : base;
            expect(painted).toBe(s.ground);
        }
    });

    it('starts on the brand canvas before the first stage', () => {
        expect(groundLayers(0).base).toBe(HERO_GROUND);
        expect(groundLayers(0).overlayOpacity).toBe(0);
    });

    it('ends on the last stage\'s ground', () => {
        const { overlay, overlayOpacity } = groundLayers(1);
        expect(overlay).toBe(STAGES[STAGES.length - 1].ground);
        expect(overlayOpacity).toBe(1);
    });
});

/**
 * Showcase imagery.
 *
 * Every stage shows real destination photography — the only real imagery we have — with
 * the treatment, not the subject, doing the work of telling them apart. A stage left on a
 * bare gradient reads as empty next to one with photographs.
 */
describe('stage showcases', () => {
    const imagesOf = (s: Stage['showcase']): string[] =>
        s.kind === 'sequence' || s.kind === 'mosaic'
            ? s.images
            : s.kind === 'crossing'
              ? [s.from, s.to]
              : [s.image];

    it('gives every stage a showcase with at least one photograph', () => {
        for (const stage of STAGES) {
            const imgs = imagesOf(stage.showcase);
            expect(imgs.length).toBeGreaterThan(0);
        }
    });

    // The paths are built with a template literal. A previous edit lost the interpolation
    // and shipped "/manila.webp" instead of "/images/destinations/manila.webp" — every
    // showcase silently rendered nothing, which looks exactly like a styling bug.
    it('points only at files that exist in public/', async () => {
        const { existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        for (const stage of STAGES) {
            for (const src of imagesOf(stage.showcase)) {
                expect(src.startsWith('/images/destinations/')).toBe(true);
                expect(existsSync(join(process.cwd(), 'public', src))).toBe(true);
            }
        }
    });

    it('uses a distinct treatment per stage, so they do not read as one backdrop', () => {
        const kinds = STAGES.map(s => s.showcase.kind);
        expect(new Set(kinds).size).toBe(STAGES.length);
    });
});

/**
 * Beats — where the descent is allowed to come to rest.
 *
 * The whole point of snapping is that stopping lands on a clean frame. A beat sitting
 * mid-blend is worse than no beat at all: it would deliberately park the visitor on the
 * double exposure the snapping exists to avoid.
 */
describe('journeyBeats', () => {
    const beats = journeyBeats();

    it('is sorted, unique, and inside the track', () => {
        expect(beats.length).toBeGreaterThan(STAGES.length);
        expect([...beats].sort((a, b) => a - b)).toEqual(beats);
        expect(new Set(beats).size).toBe(beats.length);
        for (const b of beats) {
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(1);
        }
    });

    it('offers a beat inside every stage, so no stage can be scrolled past unseen', () => {
        for (const stage of STAGES) {
            expect(beats.some(b => b >= stage.from && b <= stage.to)).toBe(true);
        }
    });

    // The property that matters: never rest between two photographs.
    it('lands on exactly one clean image in every sequence stage', () => {
        for (const stage of STAGES) {
            if (stage.showcase.kind !== 'sequence') continue;
            const count = stage.showcase.images.length;
            const inStage = beats.filter(b => b >= stage.from && b <= stage.to);
            expect(inStage.length).toBe(count);

            for (const b of inStage) {
                const t = (b - stage.from) / (stage.to - stage.from);
                const visible = Array.from({ length: count }, (_, i) => sequenceOpacity(i, count, t))
                    .filter(o => o > 0.06);
                expect(visible).toHaveLength(1);
                // And that one is fully arrived, not merely ahead of the others.
                expect(visible[0]).toBeGreaterThan(0.99);
            }
        }
    });

    it('keeps the blend short enough that most of a stage is a single image', () => {
        const count = 4;
        let clean = 0, total = 0;
        for (let t = 0; t <= 1; t += 0.002) {
            const visible = Array.from({ length: count }, (_, i) => sequenceOpacity(i, count, t))
                .filter(o => o > 0.06).length;
            if (visible <= 1) clean++;
            total++;
        }
        // Was 41% when the blend ran across nearly the whole slot.
        expect(clean / total).toBeGreaterThan(0.85);
    });
});
