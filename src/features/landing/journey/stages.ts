/**
 * The Journey: what the visitor descends through, and what each step writes onto the
 * Boarding Pass.
 *
 * Spans are **Journey Progress** — 0 at the top of the scroll track, 1 at its end. They are
 * contiguous: one stage's `to` is the next stage's `from`, so the descent reads as a direct
 * section-to-section handoff rather than drifting through bare ground between stops — the
 * reference's own property cards hand off the same way, one leaving exactly as the next
 * docks. Touching rather than overlapping: each boundary belongs to the stage ending there,
 * so only one panel is ever current (see `currentStage`'s `.find`).
 *
 * Order matters twice over. It is the order the product is introduced in, and it is the
 * order the pass fills in — a stage may only write a line below the one before it.
 */

export type StageId = 'stays' | 'flights' | 'ai' | 'options';

const IMG = '/images/destinations';

/**
 * What a Stage shows behind its search, and how.
 *
 * Every stage uses the same destination photography — it is the only real imagery we
 * have, and buying aviation or abstract art to differentiate four stages would be paying
 * for difference we can get from treatment instead. So the *subject* is constant and the
 * *handling* is what changes: a sequence walks through places, a mosaic assembles many, a
 * still settles on one.
 *
 * Gradients alone read as empty next to a stage that has photographs, which is exactly
 * how the flights stage looked when only `stays` had images.
 */
export type Showcase =
    /** Places in turn, each pushing in. The journey's opening breadth. */
    | { kind: 'sequence'; images: string[] }
    /** Many places at once, resolving tile by tile as the question is asked. */
    | { kind: 'mosaic'; images: string[] }
    /**
     * One place, held still. The descent has stopped moving; now you choose.
     *
     * `strength` is how opaque the photograph is over the stage's ground (default 0.6). A
     * photo that is meant to carry the stage itself wants most of the ground hidden.
     */
    | { kind: 'still'; image: string; strength?: number };

/**
 * What a stage looks like: its wording, the side its search docks on, and what is behind it.
 * Separate from where it sits on the track (`Stage`'s `from`/`to`) because one stretch of
 * track can wear more than one — see `Stage.faces`.
 */
export interface StageFace {
    id: StageId;
    /**
     * Small caps label above the heading, written out in full ("STAGE 01 · HOTELS") rather
     * than assembled from `index` — the last stage is "ARRIVAL" on its own, no "STAGE 04 ·"
     * prefix, since arrival isn't a numbered step of the descent.
     */
    eyebrow: string;
    /** The heading itself. Two parts so the first can be set in the display italic. */
    titleLead: string;
    titleRest: string;
    /** One line under the heading. */
    caption: string;
    /**
     * Which side the search docks on.
     *
     * Alternating, as the reference alternates its property cards. Every stage on the
     * same side turns a journey into a list: the eye stops travelling and the page reads
     * as one long left column. A stage with two faces docks them on opposite sides, which is
     * what makes changing tab a movement rather than a swap.
     */
    side: 'left' | 'right' | 'center';
    /** What sits behind this stage's search, and how it is handled. */
    showcase: Showcase;
    /**
     * The ground this stage sits on, as a CSS gradient.
     *
     * Each stage owns a colour so the descent visibly changes temperature — dusk into
     * open sky into deep space into daylight. One dark canvas for all four was the
     * flattest possible reading of "premium", and made four different products look
     * like four slides of the same one.
     */
    ground: string;
}

/** The two things the search stage can be searching for. */
export type SearchMode = 'stays' | 'flights';

export interface Stage extends StageFace {
    from: number;
    to: number;
    /**
     * Other faces this stretch of track can wear, in place. The stage's own fields are its
     * `'stays'` face; this holds the rest. Hotels and Flights are one stage: choosing the other
     * tab slides the panel across and changes the backdrop under it, rather than carrying the
     * visitor to a separate section further down the track.
     */
    faces?: { flights?: StageFace };
}

/** The face a stage shows in this mode; a stage with no face for it shows its own. */
export function faceOf(stage: Stage, mode: SearchMode): StageFace {
    return stage.faces?.[mode as 'flights'] ?? stage;
}

/** Every face a stage can wear, the stage's own first — for anything that has to know them all. */
export function stageFaces(stage: Stage): StageFace[] {
    return stage.faces ? [stage, ...(Object.values(stage.faces) as StageFace[])] : [stage];
}

/** How far across its row a panel sits: flush left, centred, or flush right. */
export const SIDE_OFFSET = { left: 0, center: 0.5, right: 1 } as const;

/**
 * Every stage that is built, shown or not. Spans here are written for the full set; what
 * the page uses is `STAGES` below, which drops the hidden ones and re-spaces the rest.
 */
const ALL_STAGES: Stage[] = [
    {
        id: 'stays',
        eyebrow: 'STAGE 01 · HOTELS',
        titleLead: 'Find',
        titleRest: 'your stay.',
        caption: 'Hotels and homes, priced per night — every fee shown before you tap book.',
        from: 0.14,
        to: 0.44,
        side: 'left',
        showcase: {
            kind: 'sequence',
            images: [`${IMG}/downtown-dusk.webp`],
        },
        // Dusk over a city. Warm at the horizon so the destination photography reads as
        // late afternoon rather than as a photo behind smoked glass.
        ground: 'linear-gradient(160deg,#0b1222 0%,#132a46 45%,#2b3f52 100%)',
        faces: {
            // Flights is this stage's other face, not a stage of its own: the Flights tab
            // slides the panel to this side and fades this backdrop in over the hotels one.
            flights: {
                id: 'flights',
                eyebrow: 'STAGE 02 · FLIGHTS',
                titleLead: 'Then',
                titleRest: 'get there.',
                caption: 'Every airline, every fare class, sorted by what you actually pay.',
                side: 'right',
                // An aircraft on the apron at dusk, held still: the photograph is the stage, so
                // it runs at near full strength rather than as a tint over the ground.
                showcase: { kind: 'still', image: `${IMG}/airport-dusk.webp`, strength: 0.95 },
                // Hidden behind the photograph; the stage keeps its own ground so the change
                // of face is the photograph's cross-fade and nothing else.
                ground: 'linear-gradient(180deg,#0a1a3a 0%,#17457e 55%,#4a8fc7 100%)',
            },
        },
    },
    {
        id: 'ai',
        eyebrow: 'STAGE 03 · AI PLANNER',
        titleLead: 'Or',
        titleRest: 'just ask.',
        caption: "Tell us the trip. We'll price the stays and routes that fit.",
        from: 0.44,
        to: 0.59,
        side: 'left',
        showcase: {
            kind: 'mosaic',
            images: [
                `${IMG}/tokyo.webp`, `${IMG}/bali.webp`, `${IMG}/boracay.webp`,
                `${IMG}/manila.webp`, `${IMG}/hong-kong.webp`, `${IMG}/osaka.webp`,
            ],
        },
        // Deep space for the constellation to read against — the one genuinely dark
        // stage, and dark because the content is points of light.
        ground: 'radial-gradient(120% 90% at 70% 20%,#1b1246 0%,#0d1030 45%,#05070f 100%)',
    },
    {
        id: 'options',
        eyebrow: 'ARRIVAL',
        titleLead: 'Now',
        titleRest: 'choose.',
        caption: 'Stays, flights and golf, all in one place.',
        // Running to the very end of the track: this is where the descent stops moving, so
        // it is the one stage that stays rather than leaving. The track used to hold a final
        // empty viewport after it, and a snap stop landed there — a blank screen with only
        // the footer on it.
        from: 0.59,
        to: 1,
        side: 'center',
        // A dusk coastline held still, at near full strength: the photograph is the stage.
        showcase: { kind: 'still', image: `${IMG}/dusk-coast.webp`, strength: 0.95 },
        // Daylight. The descent ends somewhere bright, so arriving at the choice feels
        // like arriving rather than like the page running out.
        ground: 'linear-gradient(180deg,#123a5c 0%,#1d6ea8 50%,#2aa5c9 100%)',
    },
];

/**
 * Stages that are built but kept off the page. The AI planner is parked here: its panel,
 * showcase and copy are all still in the codebase, so bringing it back — or reusing the
 * slot for something else — is deleting its id from this list, not rebuilding it.
 */
const HIDDEN_STAGES: readonly StageId[] = ['ai'];

/**
 * Close the gap left by hidden stages: the visible ones share the whole span from the
 * first stage's start to the last stage's end, each keeping its authored share of it.
 * Without this a hidden stage leaves a stretch of empty track, and with it the page
 * scrolls through bare ground between two stages. Unchanged when nothing is hidden.
 */
function reflow(all: Stage[], hidden: readonly StageId[]): Stage[] {
    const visible = all.filter(s => !hidden.includes(s.id));
    if (visible.length === all.length) return all;

    const start = all[0].from;
    const end = all[all.length - 1].to;
    const total = visible.reduce((sum, s) => sum + (s.to - s.from), 0);
    const scale = (end - start) / total;

    let cursor = start;
    return visible.map((s, i) => {
        const from = cursor;
        const to = i === visible.length - 1 ? end : cursor + (s.to - s.from) * scale;
        cursor = to;
        return { ...s, from, to };
    });
}

export const STAGES: Stage[] = reflow(ALL_STAGES, HIDDEN_STAGES);

/** Every photograph a showcase draws, for anything that needs to fetch them ahead of time. */
export function showcaseImages(s: Showcase): string[] {
    return s.kind === 'sequence' || s.kind === 'mosaic' ? s.images : [s.image];
}

/**
 * Quick-pick destinations shown as chips under the Stays search.
 *
 * Independent of the stage's showcase backdrop (which now holds on one photo rather than
 * cross-fading through these) — clicking a chip sets the search destination regardless of
 * what is behind it.
 *
 * `fetchActStays` looks each of these up in our own tables by city name — the first three
 * have real promoted listings and come back priced; Oklahoma City does not, so its chip
 * names the destination without a price, the same graceful path an outage in any of the
 * others already falls back to.
 */
export const SHOWCASE_DESTINATIONS = [
    { city: 'Seoul', countryCode: 'KR', src: '/images/destinations/seoul.webp' },
    { city: 'Tokyo', countryCode: 'JP', src: '/images/destinations/tokyo.webp' },
    { city: 'Bali', countryCode: 'ID', src: '/images/destinations/bali.webp' },
    { city: 'Oklahoma City', countryCode: 'US', src: '/images/destinations/downtown-dusk.webp' },
] as const;

/**
 * How tall the scroll track is, in viewport heights.
 *
 * The one number that sets the pace of the whole descent: lower and the stages flick past
 * before a search can be used, higher and the page stops responding to the wheel.
 */
export const JOURNEY_SCREENS = 5;

/** Journey Progress at which the hero copy has fully faded. */
export const HERO_FADE_END = 0.14;

/**
 * How far into its span a stage is when a wheel gesture parks on it.
 *
 * Not 0: a stage's panel and backdrop fade in over the first 2% of its span, so parking on
 * `from` lands on a nearly transparent stage — the visitor arrives at a dimmed screen and
 * has to scroll again to see what they scrolled to. A quarter in is well past every fade-in
 * (and the heading's per-letter reveal) and still early enough that each showcase is at its
 * opening frame rather than mid-handover.
 */
export const STAGE_DOCK = 0.25;

/**
 * Where one wheel gesture lands: the top (hero), each stage's dock, and — for the last stage —
 * the end of the track, which is the bottom of the page. The last stage runs to the end and
 * stays, with the footer rising over it, so it settles there rather than a quarter of the way
 * in: a dock of its own would be a stop that only moved the footer. Derived from `STAGES`
 * rather than written out separately, so moving a stage's span in this file can never leave a
 * stop pointing at empty ground.
 */
export const JOURNEY_STOPS: number[] = [
    0,
    ...STAGES.slice(0, -1).map(s => s.from + (s.to - s.from) * STAGE_DOCK),
    1,
];

/**
 * Fraction of the way through its own span, 0 → 1, or null when the stage is not current.
 *
 * Everything belonging to a stage reads this rather than raw Journey Progress, so moving a
 * span in this file moves its showcase, its heading and its search together.
 */
export function stageProgress(stage: Stage, journey: number): number | null {
    if (journey < stage.from || journey > stage.to) return null;
    return (journey - stage.from) / (stage.to - stage.from);
}

/** The stage the visitor is in, or null between stages. */
export function currentStage(journey: number): Stage | null {
    return STAGES.find(s => journey >= s.from && journey <= s.to) ?? null;
}

/**
 * Has the Journey reached the point where this stage writes its Pass Line?
 *
 * Written at the stage's midpoint rather than its start: a line that appears the instant a
 * stage docks reads as pre-filled, where one that lands while the visitor is looking at the
 * stage reads as the page responding to them.
 */
export function hasWritten(stage: Stage, journey: number): boolean {
    return journey >= stage.from + (stage.to - stage.from) * 0.5;
}

/**
 * How visible image `i` of a sequence is, `t` being progress through that stage.
 *
 * The blend is deliberately short. At a wide blend each image fades across almost its
 * whole slot, so two photographs are stacked most of the time — which does not read as a
 * transition, it reads as the picture being out of focus. Narrow enough and a single
 * clean image holds for the great majority of the stage.
 */
export const SEQUENCE_BLEND = 0.08;

export function sequenceOpacity(i: number, count: number, t: number): number {
    const slot = 1 / count;
    const start = i * slot;
    const fade = slot * SEQUENCE_BLEND;
    return Math.min(
        ramp(t, start - fade, start + fade),
        1 - ramp(t, start + slot - fade, start + slot + fade),
    );
}


/** Half-width, in Journey Progress, of the cross-fade between one stage's backdrop and the
 *  next. About a quarter of a screen of scroll either side of the seam. */
export const SHOWCASE_CROSSFADE = 0.03;

/**
 * How visible a stage's backdrop is at this point in the descent.
 *
 * Cross-faded over the boundary rather than faded out and back in: the outgoing backdrop and
 * the incoming one share the same window either side of the seam, so their opacities sum to one
 * and the ground never shows through between. The last stage has no seam after it, so it never
 * fades out — it is what the journey ends on.
 */
export function showcaseOpacity(journey: number, from: number, to: number, isLast: boolean): number {
    const fadeIn  = ramp(journey, from - SHOWCASE_CROSSFADE, from + SHOWCASE_CROSSFADE);
    const fadeOut = isLast ? 0 : ramp(journey, to - SHOWCASE_CROSSFADE, to + SHOWCASE_CROSSFADE);
    return Math.min(fadeIn, 1 - fadeOut);
}

/**
 * Where a stage's panel is, given how far through its own span the visitor is (`t`).
 *
 * `shift` is how far it is from sitting still: positive while arriving (offset below its
 * resting place), negative while leaving (offset above it), 0 when docked. Arrival finishes
 * before the stage's dock point (`STAGE_DOCK`), so a stop always lands on a settled stage;
 * departure starts well after it, so the stage is whole while the visitor uses it, then moves
 * off with the scroll. The last stage never leaves: nothing follows it to make room for.
 */
export function stageMotion(t: number, isLast: boolean): { shift: number; opacity: number } {
    const arriving = 1 - ramp(t, 0, 0.2);
    const leaving = isLast ? 0 : ramp(t, 0.45, 1);
    const fadeOut = isLast ? 0 : ramp(t, 0.6, 1);
    return {
        shift: arriving - leaving,
        opacity: Math.min(ramp(t, 0, 0.12), 1 - fadeOut),
    };
}

/** The brand canvas, which the descent starts on before the first stage's ground. */
export const HERO_GROUND =
    'radial-gradient(120% 80% at 50% 0%,#0f172a 0%,#0b1222 45%,#020617 100%)';

/**
 * The two ground layers to paint at this point in the descent, and how far between them.
 *
 * Returns a base and an overlay rather than an opacity per stage. Fading every ground in
 * and out independently never summed to 1 — the best any stage reached was about 0.7, so
 * the near-black base always showed through and *every* stage rendered black whatever
 * colour it had been given. Two layers, the upper one fading in, is always opaque.
 */
export function groundLayers(journey: number): {
    base: string;
    overlay: string;
    overlayOpacity: number;
} {
    const stops = [
        { at: 0, ground: HERO_GROUND },
        ...STAGES.map(s => ({ at: (s.from + s.to) / 2, ground: s.ground })),
    ];

    let i = 0;
    while (i < stops.length - 2 && journey >= stops[i + 1].at) i++;

    const from = stops[i];
    const to = stops[i + 1] ?? from;

    return {
        base: from.ground,
        overlay: to.ground,
        overlayOpacity: to.at > from.at ? ramp(journey, from.at, to.at) : 1,
    };
}

/**
 * Eased 0 → 1 over [start, end], clamped outside it.
 *
 * Linear on purpose: these drive opacity against scroll position, and easing a value
 * already tied to a finger makes the result feel like it is lagging the gesture.
 */
export function ramp(value: number, start: number, end: number): number {
    if (end <= start) return value >= end ? 1 : 0;
    return Math.max(0, Math.min(1, (value - start) / (end - start)));
}
