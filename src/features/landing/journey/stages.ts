/**
 * The Journey: what the visitor descends through, and what each step writes onto the
 * Boarding Pass.
 *
 * Spans are **Journey Progress** — 0 at the top of the scroll track, 1 at its end. They
 * are deliberately not contiguous; the gaps are where one stage has left and the next has
 * not docked, which is what gives the descent a rhythm instead of a hard cut.
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
 * *handling* is what changes: a sequence walks through places, a crossing travels between
 * two, a mosaic assembles many, a still settles on one.
 *
 * Gradients alone read as empty next to a stage that has photographs, which is exactly
 * how the flights stage looked when only `stays` had images.
 */
export type Showcase =
    /** Places in turn, each pushing in. The journey's opening breadth. */
    | { kind: 'sequence'; images: string[] }
    /** Departure to arrival, panning sideways with the aircraft. */
    | { kind: 'crossing'; from: string; to: string }
    /** Many places at once, resolving tile by tile as the question is asked. */
    | { kind: 'mosaic'; images: string[] }
    /** One place, held still. The descent has stopped moving; now you choose. */
    | { kind: 'still'; image: string };

export interface Stage {
    id: StageId;
    /** Numbered in the UI, as the reference design numbers its sections. */
    index: number;
    /** Small caps label above the heading. */
    eyebrow: string;
    /** The heading itself. Two parts so the first can be set in the display italic. */
    titleLead: string;
    titleRest: string;
    /** One line under the heading. */
    caption: string;
    from: number;
    to: number;
    /**
     * Which side the search docks on.
     *
     * Alternating, as the reference alternates its property cards. Every stage on the
     * same side turns a journey into a list: the eye stops travelling and the page reads
     * as one long left column. The Boarding Pass takes the opposite side and swaps with it.
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

export const STAGES: Stage[] = [
    {
        id: 'stays',
        index: 1,
        eyebrow: 'Search & discover',
        titleLead: 'Find',
        titleRest: 'your stay.',
        caption: 'Hotels, homes and everything between — priced per night, not per surprise.',
        from: 0.10,
        to: 0.28,
        side: 'left',
        showcase: {
            kind: 'sequence',
            images: [`${IMG}/seoul.webp`, `${IMG}/tokyo.webp`, `${IMG}/bali.webp`, `${IMG}/boracay.webp`],
        },
        // Dusk over a city. Warm at the horizon so the destination photography reads as
        // late afternoon rather than as a photo behind smoked glass.
        ground: 'linear-gradient(160deg,#0b1222 0%,#132a46 45%,#2b3f52 100%)',
    },
    {
        id: 'flights',
        index: 2,
        eyebrow: 'Get there',
        titleLead: 'Then',
        titleRest: 'get there.',
        caption: 'Every carrier we can reach, compared on the fare you actually pay.',
        from: 0.32,
        to: 0.50,
        side: 'right',
        // A real route we sell, and both files are light: the crossing pans across two
        // full-bleed photographs, so heavy ones would be felt.
        showcase: { kind: 'crossing', from: `${IMG}/manila.webp`, to: `${IMG}/tokyo.webp` },
        // Open sky at altitude: deep blue overhead falling to a lit horizon.
        ground: 'linear-gradient(180deg,#0a1a3a 0%,#17457e 55%,#4a8fc7 100%)',
    },
    {
        id: 'ai',
        index: 3,
        eyebrow: 'Or just ask',
        titleLead: 'Ask',
        titleRest: 'for a plan.',
        caption: 'Describe the trip. It answers with stays, routes and dates you can book.',
        from: 0.54,
        to: 0.70,
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
        index: 4,
        eyebrow: 'Everything, together',
        titleLead: 'Now',
        titleRest: 'choose.',
        caption: 'One search across stays, flights and cars.',
        from: 0.74,
        to: 0.855,
        side: 'center',
        showcase: { kind: 'still', image: `${IMG}/palawan.webp` },
        // Daylight. The descent ends somewhere bright, so arriving at the choice feels
        // like arriving rather than like the page running out.
        ground: 'linear-gradient(180deg,#123a5c 0%,#1d6ea8 50%,#2aa5c9 100%)',
    },
];

/**
 * Destination photography behind the Stays stage.
 *
 * Four real places we sell, cross-fading across that stage's span so the search sits on
 * somewhere rather than on a gradient. These used to be the journey itself; they are now
 * the Showcase for one step of it.
 */
export const SHOWCASE_DESTINATIONS = [
    { city: 'Seoul', countryCode: 'KR', src: '/images/destinations/seoul.webp' },
    { city: 'Tokyo', countryCode: 'JP', src: '/images/destinations/tokyo.webp' },
    { city: 'Bali', countryCode: 'ID', src: '/images/destinations/bali.webp' },
    { city: 'Boracay', countryCode: 'PH', src: '/images/destinations/boracay.webp' },
] as const;

/**
 * How tall the scroll track is, in viewport heights.
 *
 * The one number that sets the pace of the whole descent: lower and the stages flick past
 * before a search can be used, higher and the page stops responding to the wheel.
 */
export const JOURNEY_SCREENS = 7;

/** Journey Progress at which the hero copy has fully faded. */
export const HERO_FADE_END = 0.10;

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
 *
 * Lives here, beside the beats, because the two have to agree: a beat is only worth
 * snapping to if this returns a clean frame there.
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

/**
 * Where the descent is allowed to come to rest, as Journey Progress.
 *
 * A beat is a moment the showcase is *clean* — one photograph, fully arrived, nothing
 * mid-blend. The track carries a snap target at each of these, so stopping anywhere near
 * one settles onto it and the visitor never ends up parked on a dissolve between two
 * images, which reads as the picture being out of focus rather than as a transition.
 *
 * Derived from each stage's showcase rather than listed by hand: adding a destination to
 * a sequence adds its beat automatically, and a beat can never drift away from the frame
 * it was meant to mark.
 */
export function journeyBeats(): number[] {
    const beats: number[] = [0];

    for (const stage of STAGES) {
        const span = stage.to - stage.from;
        const at = (f: number) => stage.from + span * f;
        const s = stage.showcase;

        if (s.kind === 'sequence') {
            // The middle of each image's slot: fully arrived, nothing else on screen.
            const slot = 1 / s.images.length;
            for (let i = 0; i < s.images.length; i++) beats.push(at(i * slot + slot / 2));
        } else if (s.kind === 'crossing') {
            // Either side of the handover — departure held, then arrival held.
            beats.push(at(0.25), at(0.78));
        } else if (s.kind === 'mosaic') {
            // Once the grid has finished assembling.
            beats.push(at(0.82));
        } else {
            beats.push(at(0.5));
        }
    }

    return [...new Set(beats)].sort((a, b) => a - b);
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
