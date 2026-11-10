import { describe, it, expect, vi, afterEach } from 'vitest';
import en from '@/locales/en.json';
import {
    JOURNEY_SCREENS,
    JOURNEY_STOPS,
    SHOWCASE_DESTINATIONS,
    STAGES,
    STAGE_DOCK,
    currentStage,
    hasWritten,
    ramp,
    stageProgress,
    groundLayers,
    HERO_GROUND,
    sequenceOpacity,
    stageMotion,
    showcaseOpacity,
    faceOf,
    stageFaces,
    SIDE_OFFSET,
    type Stage,
} from '@/features/landing/journey/stages';
import { snapTargets } from '@/features/landing/journey/useSectionSnap';
import { fetchActStays } from '@/features/landing/api/featured.api';

/**
 * The Journey's timing spine. Every visible layer — showcase, docked search, altitude
 * readout — positions itself from these, so an error here moves all of them at once and in
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
        expect(STAGES.map(s => s.id)).toEqual(['stays']);
    });

    it('keeps the AI planner off the page, with no empty track left where it was', () => {
        expect(STAGES.some(s => s.id === 'ai')).toBe(false);
        for (let i = 1; i < STAGES.length; i++) {
            expect(STAGES[i].from).toBe(STAGES[i - 1].to);
        }
    });

    it('never overlaps — two docked searches at once would fight over the store', () => {
        // Touching is fine (one stage's `to` is the next stage's `from`, for a direct
        // section-to-section handoff) — only actual overlap would mount two panels at once.
        for (let i = 1; i < STAGES.length; i++) {
            expect(STAGES[i].from).toBeGreaterThanOrEqual(STAGES[i - 1].to);
        }
    });

    it('leaves the hero room before the first stage', () => {
        expect(STAGES[0].from).toBeGreaterThanOrEqual(0.1);
    });

    // The journey ends on its last stage. It used to leave the track's final viewport empty as
    // "room to exit", and a final snap stop landed there: a near-blank screen with only the
    // footer on it, after the stage that was meant to be the end.
    it('runs the last stage to the end of the track, so no empty screen follows it', () => {
        expect(STAGES[STAGES.length - 1].to).toBe(1);
    });

    it('keeps every span inside the track', () => {
        expect(JOURNEY_SCREENS).toBeGreaterThan(1);
        STAGES.forEach(s => {
            expect(s.from).toBeGreaterThanOrEqual(0);
            expect(s.to).toBeLessThanOrEqual(1);
            expect(s.to).toBeGreaterThan(s.from);
        });
    });
});

describe('JOURNEY_STOPS', () => {
    it('is the top, then a dock for each stage — the last one included, since it is the search', () => {
        const docks = STAGES.map(s => s.from + (s.to - s.from) * STAGE_DOCK);
        expect(JOURNEY_STOPS).toEqual([0, ...docks]);
        // One stop for the hero and one for each stage: past the last, the page scrolls into the footer.
        expect(JOURNEY_STOPS).toHaveLength(STAGES.length + 1);
    });

    // The track used to run five screens, and with nothing after the search but the footer, the
    // visitor scrolled on through empty screens before it arrived. The footer has to start rising
    // within a notch of leaving the last stop, and not already be showing at it.
    it('brings the footer up a notch after the last stop, with no empty screens before it', () => {
        const lastStop = JOURNEY_STOPS[JOURNEY_STOPS.length - 1];
        const footerEnters = 1 - 1 / JOURNEY_SCREENS;
        expect(footerEnters, 'the footer is already showing at the last stop').toBeGreaterThanOrEqual(lastStop);
        // In screens: a wheel notch is around a tenth of one.
        expect((footerEnters - lastStop) * JOURNEY_SCREENS, 'empty track after the last stop').toBeLessThan(0.1);
    });

    it('parks every stage past its fade-in, never on the transparent edge', () => {
        STAGES.forEach((stage, i) => {
            const t = stageProgress(stage, JOURNEY_STOPS[i + 1]);
            expect(t).not.toBeNull();
            expect(ramp(t!, 0, 0.02)).toBe(1);
            expect(currentStage(JOURNEY_STOPS[i + 1])?.id).toBe(stage.id);
        });
    });

    it('is strictly increasing, so a snap in either direction always has somewhere to go', () => {
        for (let i = 1; i < JOURNEY_STOPS.length; i++) {
            expect(JOURNEY_STOPS[i]).toBeGreaterThan(JOURNEY_STOPS[i - 1]);
        }
    });
});

describe('currentStage', () => {
    it('finds the stage the visitor is inside', () => {
        expect(currentStage(STAGES[0].from + 0.01)?.id).toBe('stays');
    });

    it('is null before the first stage docks', () => {
        expect(currentStage(0)).toBeNull();
    });

    it('hands off cleanly at a shared boundary — never both stages, never neither', () => {
        for (let i = 1; i < STAGES.length; i++) {
            const boundary = STAGES[i - 1].to;
            expect(boundary).toBe(STAGES[i].from);
            expect(currentStage(boundary)?.id).toBe(STAGES[i - 1].id);
        }
    });
});

describe('hasWritten', () => {
    const stage = STAGES[0];

    it('holds the Pass Line until the stage is half crossed', () => {
        // Appearing the instant a stage docks reads as pre-filled; landing while the
        // visitor is looking at the stage reads as the page answering them.
        expect(hasWritten(stage, stage.from)).toBe(false);
        expect(hasWritten(stage, stage.from + (stage.to - stage.from) * 0.5)).toBe(true);
    });

    it('stays written once the stage is behind you', () => {
        expect(hasWritten(stage, 1)).toBe(true);
    });

    it('writes the lines in stage order, never ahead of the descent', () => {
        for (let i = 1; i < STAGES.length; i++) {
            const [a, b] = [STAGES[i - 1], STAGES[i]];
            const midFirst = a.from + (a.to - a.from) * 0.5;
            const midSecond = b.from + (b.to - b.from) * 0.5;
            expect(hasWritten(a, midFirst)).toBe(true);    // being crossed
            expect(hasWritten(b, midFirst)).toBe(false);   // not reached
            expect(hasWritten(a, midSecond)).toBe(true);   // already passed
            expect(hasWritten(b, midSecond)).toBe(true);   // being crossed
        }
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
        expect(Object.keys(out).sort()).toEqual(['Bali', 'Oklahoma City', 'Seoul']);
    });
});

describe('stage sides and grounds', () => {
    it('alternates sides — every stage on one side reads as a list, not a journey', () => {
        const sided = STAGES.filter(s => s.side !== 'center');
        for (let i = 1; i < sided.length; i++) {
            expect(sided[i].side).not.toBe(sided[i - 1].side);
        }
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
        s.kind === 'sequence' || s.kind === 'mosaic' ? s.images : [s.image];

    it('gives every stage a showcase with at least one photograph', () => {
        for (const stage of STAGES) {
            for (const face of stageFaces(stage)) {
                expect(imagesOf(face.showcase).length).toBeGreaterThan(0);
            }
        }
    });

    // The paths are built with a template literal. A previous edit lost the interpolation
    // and shipped "/manila.webp" instead of "/images/destinations/manila.webp" — every
    // showcase silently rendered nothing, which looks exactly like a styling bug.
    // Photographs a face is wired to but that have not been delivered yet. Each face listed here
    // shows its own ground until its file lands (`StageShowcase`), so nothing looks broken — but
    // this list is the reminder: delete the entry when the file is added.
    const AWAITING_PHOTO = new Set(['/images/destinations/golf-dusk.webp']);

    it('points only at files that exist in public/', async () => {
        const { existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        for (const stage of STAGES) {
            for (const face of stageFaces(stage)) {
                for (const src of imagesOf(face.showcase)) {
                    expect(src.startsWith('/images/destinations/')).toBe(true);
                    if (AWAITING_PHOTO.has(src)) continue;
                    expect(existsSync(join(process.cwd(), 'public', src)), src).toBe(true);
                }
            }
        }
    });

    it('waits only on photographs that are actually missing', async () => {
        const { existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        for (const src of AWAITING_PHOTO) {
            expect(existsSync(join(process.cwd(), 'public', src)), `${src} has arrived: drop it from AWAITING_PHOTO`).toBe(false);
        }
    });

    it('gives each stage its own showcase, so they do not read as one backdrop', () => {
        const showcases = STAGES.flatMap(s => stageFaces(s)).map(f => JSON.stringify(f.showcase));
        expect(new Set(showcases).size).toBe(showcases.length);
    });
});

describe('sequenceOpacity', () => {
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

describe('the last stage stays; the others leave', () => {
    const last = STAGES[STAGES.length - 1];

    it('does not move out or fade at the end of its span', () => {
        expect(stageMotion(1, true)).toEqual({ shift: 0, opacity: 1 });
    });

    it('lets an earlier stage leave as its span ends: up, and gone', () => {
        const m = stageMotion(1, false);
        expect(m.opacity).toBe(0);
        expect(m.shift).toBeLessThan(0);
    });

    it('arrives the same way whichever stage it is', () => {
        for (const isLast of [true, false]) {
            expect(stageMotion(0, isLast).opacity).toBe(0);
            expect(stageMotion(0, isLast).shift).toBe(1);
            expect(stageMotion(0.25, isLast)).toEqual({ shift: 0, opacity: 1 });
        }
    });

    it('keeps the last backdrop up at the end of the track instead of fading it away', () => {
        expect(showcaseOpacity(1, last.from, last.to, true)).toBe(1);
    });

    it('still fades an earlier backdrop out across the boundary', () => {
        const first = STAGES[0];
        expect(showcaseOpacity(first.to + 0.1, first.from, first.to, false)).toBe(0);
        expect(showcaseOpacity((first.from + first.to) / 2, first.from, first.to, false)).toBe(1);
    });
});

describe('snapTargets', () => {
    it('is each stop in pixels from the top of the track', () => {
        expect(snapTargets([0, 0.2, 0.5], 100, 5000, 99_999)).toEqual([100, 1100, 2600]);
    });

    it('never aims past the bottom of the page — the stop for the end of the track is the bottom', () => {
        // A track whose last viewport is the footer's, not empty: the page ends before the
        // track's own end, and a target beyond it eases toward a place it cannot reach.
        expect(snapTargets([0, 0.4, 1], 0, 5600, 4908)).toEqual([0, 2240, 4908]);
    });
});

/**
 * Hotels, Flights and Golf are three faces of one stage, not three stages. Choosing another tab
 * used to glide the visitor to a separate section further down the track (or, for Golf, off the
 * page); now the panel slides across in place and the backdrop changes under it.
 */
describe('the search stage and its faces', () => {
    const search = STAGES[0];

    it('is one stage with Flights and Golf as faces of it, not stages of their own', () => {
        expect(STAGES.some(s => s.id === 'flights' || s.id === 'golf')).toBe(false);
        expect(search.id).toBe('stays');
        expect(search.faces?.flights?.id).toBe('flights');
        expect(search.faces?.golf?.id).toBe('golf');
    });

    it('shows the hotels face by default and the others when asked', () => {
        expect(faceOf(search, 'stays').id).toBe('stays');
        expect(faceOf(search, 'flights').id).toBe('flights');
        expect(faceOf(search, 'golf').id).toBe('golf');
    });

    it('has nothing to switch on a stage with a single face', () => {
        const single: Stage = { ...search, faces: undefined };
        expect(faceOf(single, 'flights')).toBe(single);
        expect(faceOf(single, 'golf')).toBe(single);
        expect(stageFaces(single)).toEqual([single]);
    });

    it('lists the faces in the order the tabs are', () => {
        expect(stageFaces(search).map(f => f.id)).toEqual(['stays', 'flights', 'golf']);
    });

    it('docks each on a side of its own, so every change of tab moves the panel', () => {
        expect(faceOf(search, 'stays').side).toBe('left');
        expect(faceOf(search, 'flights').side).toBe('right');
        expect(faceOf(search, 'golf').side).toBe('center');
    });

    it('gives each its own wording and its own backdrop, so the change is seen', () => {
        const faces = stageFaces(search);
        // The wording is in the message files, keyed by face id: a set of words per face.
        const words = (id: 'stays' | 'flights' | 'golf') => JSON.stringify(en.landing.journey.stages[id]);
        expect(new Set(faces.map(f => f.id)).size).toBe(faces.length);
        expect(new Set(faces.map(f => words(f.id as 'stays' | 'flights' | 'golf'))).size).toBe(faces.length);
        expect(new Set(faces.map(f => JSON.stringify(f.showcase))).size).toBe(faces.length);
    });

    it('gives golf a ground of its own, for when its photograph will not load', () => {
        expect(faceOf(search, 'golf').ground).not.toBe(search.ground);
    });
});

describe('SIDE_OFFSET', () => {
    it('places a panel flush left, centred, or flush right — the animation moves between these', () => {
        expect(SIDE_OFFSET).toEqual({ left: 0, center: 0.5, right: 1 });
    });
});
