'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { useMoney } from '@/features/landing/lib/money';
import { ImmersiveSearchBar } from '@/features/search/components/immersive-search-bar';
import type { TrendingDest } from '@/features/search/components/immersive-search-bar';
import type { FeaturedStay } from '@/features/landing/api/featured.api';
import { formatCurrency } from '@/shared/lib/format';
import { isGolfFace } from '@/features/golf/lib/last-search';
import { useGolfCourses } from '@/features/golf/lib/use-golf-courses';
import type { GolfCourse } from '@/features/golf/types';
import {
    HERO_FADE_END,
    JOURNEY_STOPS,
    SHOWCASE_DESTINATIONS,
    SIDE_OFFSET,
    STAGES,
    currentStage,
    faceOf,
    ramp,
    showcaseImages,
    stageFaces,
    stageMotion,
    stageProgress,
    type SearchMode,
    type Stage,
    type StageFace,
} from './stages';
import { useJourneyProgress } from './useJourneyProgress';
import { useSectionSnap } from './useSectionSnap';
import { StageShowcase } from './StageShowcase';
import { HeroBackdrop } from './HeroBackdrop';

/** The stop the search docks on, in `JOURNEY_STOPS`: the hero is stop 0, then a stop per stage. */
const SEARCH_STOP = STAGES.findIndex(s => s.faces?.golf) + 1;

/**
 * The landing page's Journey.
 *
 * Structurally one tall empty spacer plus a set of fixed layers. The spacer is the only
 * thing in document flow — it exists purely to give the page something to scroll — and
 * every visible layer is `fixed`, reading Journey Progress to decide where it is.
 *
 * The one rule that shapes the rest: **only the current stage's search is mounted.** Both
 * search bars write to the same `useSearchStore`, so two live instances would overwrite
 * each other's destination and mode as the visitor scrolled between them. Mounting one at
 * a time makes that impossible rather than merely unlikely.
 */
export function Journey({
    trending,
    showcaseStays,
}: {
    trending?: TrendingDest[];
    /**
     * Promoted stay per showcase city, keyed by city name. Read from our own tables, never
     * from a supplier — see ADR 0005. Empty is an ordinary state: the strip then names the
     * destinations without quoting a price.
     */
    showcaseStays: Record<string, FeaturedStay>;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    // The Journey's own box. Only the track is in flow, so its bottom edge is where the page's
    // footer begins — which is what the last stage reads to get out of the footer's way.
    const rootRef = useRef<HTMLDivElement>(null);
    const { journey, trackPx, reducedMotion } = useJourneyProgress(trackRef);
    const goToStop = useSectionSnap(trackRef, JOURNEY_STOPS, trackPx, reducedMotion);
    const tAll = useTranslations();

    // What the search stage is searching for. Held here, above the stage, so it survives the
    // visitor scrolling away and back; changing it slides the panel across and changes the
    // backdrop in place — the Stays / Flights / Golf tabs never carry anyone to another section.
    const [mode, setMode] = useState<SearchMode>('stays');

    // Back from a golf course found here: the search itself, Golf face up, not the hero. Read from
    // the address in the browser so this page stays cached. Once only, because `trackPx` moves on
    // every resize, and a visitor who has scrolled on must not be carried back.
    const cameBack = useRef(false);
    useEffect(() => {
        if (cameBack.current || !isGolfFace(window.location.search)) return;
        if (reducedMotion) {
            cameBack.current = true;
            document.getElementById('stage-golf')?.scrollIntoView();
        } else if (trackPx > 0) {
            cameBack.current = true;
            setMode('golf');
            goToStop(SEARCH_STOP);
        }
    }, [reducedMotion, trackPx, goToStop]);

    // Every stage photograph, fetched once the page is idle. Each is otherwise first requested
    // the moment its stage mounts — partway through a glide — and pops in a beat after the
    // text, which is the one thing that makes an otherwise smooth transition look unfinished.
    useEffect(() => {
        if (reducedMotion) return;
        const urls = [...new Set(STAGES.flatMap(stageFaces).flatMap(f => showcaseImages(f.showcase)))];
        // Decoded as well as fetched: a large photograph that has arrived but not been decoded
        // still appears a beat after the text that sits on it.
        const load = () => urls.forEach(src => {
            const img = new Image();
            img.decoding = 'async';
            img.src = src;
            img.decode?.().catch(() => undefined);
        });
        // Safari has no requestIdleCallback.
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(load);
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(load, 800);
        return () => window.clearTimeout(id);
    }, [reducedMotion]);

    // Reduced motion: no track, no fixed layers, no choreography. The same stages, stated
    // in order as an ordinary page. Someone who asked for less motion still gets the product.
    if (reducedMotion) {
        return (
            <>
                <StageShowcase journey={0} mode="stays" reducedMotion />
                <div className="relative z-[1] mx-auto w-full max-w-5xl space-y-20 px-6 py-24">
                    {STAGES.flatMap(stageFaces).map(face => (
                        <section key={face.id} id={`stage-${face.id}`}>
                            <StageHeading stage={face} />
                            <div className="mt-8">
                                <StageSurface stage={face} trending={trending} stays={showcaseStays} />
                            </div>
                        </section>
                    ))}
                </div>
            </>
        );
    }

    const heroOpacity = 1 - ramp(journey, 0.02, HERO_FADE_END);
    const heroOut = ramp(journey, 0, HERO_FADE_END);
    const active = currentStage(journey);

    // The journey ends on its last stage and the page ends with it: nothing is faded out or
    // taken down at the end of the track. The footer comes up under the fixed layers, and the
    // last stage rides up ahead of it once the two would meet — see `useFooterClearance`.
    return (
        <div ref={rootRef}>
            <StageShowcase journey={journey} mode={mode} reducedMotion={false} />

            {/* Hero. Fades rather than scrolls away, so the page's first movement is the
                product arriving, not the headline leaving. */}
            {heroOpacity > 0.01 && (
                <div
                    className="pointer-events-none fixed inset-0 z-[2] flex flex-col items-start justify-center px-6 text-left sm:px-10 lg:px-16"
                    style={{ opacity: heroOpacity }}
                >
                    <HeroBackdrop />

                    {/* Each line leaves at its own speed and, for the headline, its own
                        direction, so the hero comes apart as the next section arrives
                        instead of dimming in place. `heroOut` follows the same scroll
                        position as the snap's glide, so it plays out during the jump. */}
                    <p
                        className="text-[11px] tracking-[0.4em] text-white/55 uppercase will-change-transform"
                        style={{ transform: `translateY(${-heroOut * 36}px)` }}
                    >
                        {tAll('landing.journey.hero.kicker')}
                    </p>
                    {/* Edge-to-edge and uppercase rather than our usual italic-lead-word
                        treatment — the hero is the one place that reads as a statement
                        rather than a stage being introduced, so it earns its own voice. */}
                    <h1 className="mt-6 w-full text-5xl leading-[0.9] font-bold tracking-tight text-white uppercase sm:text-7xl lg:text-8xl">
                        <span
                            className="block will-change-transform"
                            style={{ transform: `translate(${-heroOut * 64}px, ${-heroOut * 70}px)` }}
                        >
                            {tAll('landing.journey.hero.titleLine1')}
                        </span>
                        <span
                            className="block will-change-transform"
                            style={{ transform: `translate(${heroOut * 64}px, ${-heroOut * 110}px)` }}
                        >
                            {tAll('landing.journey.hero.titleLine2')}
                        </span>
                    </h1>
                    <p
                        className="mt-6 max-w-md text-base text-white/70 will-change-transform"
                        style={{ transform: `translateY(${-heroOut * 150}px)` }}
                    >
                        {tAll('landing.journey.hero.subtitle')}
                    </p>

                    {/* Gone within the first sliver of scroll: once the visitor has taken the
                        hint it has done its job, and it should not trail them into the stage. */}
                    <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-1.5 text-white/60"
                        style={{ opacity: 1 - ramp(journey, 0, 0.03) }}
                    >
                        <span className="text-[11px] tracking-[0.35em] uppercase">{tAll('landing.journey.hero.scrollCue')}</span>
                        <svg
                            className="animate-bounce"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>
                </div>
            )}

            <AltitudeReadout journey={journey} />

            {/* The docked stage: heading and the product surface it is about. Left-weighted,
                leaving the right clear for the altitude readout, as the reference lays it out. */}
            {active && (
                <StagePanel
                    key={active.id}
                    stage={active}
                    mode={mode}
                    journey={journey}
                    trending={trending}
                    stays={showcaseStays}
                    onModeSelect={setMode}
                    journeyRef={rootRef}
                />
            )}

            {/*
              The scroll track. Empty by design — it is distance, not content.

              Rendered only once measured: at SSR and on the first client paint `trackPx`
              is 0, and committing to a guessed height would shift the whole page under the
              visitor the moment the real one arrived.
            */}
            {trackPx > 0 && <JourneyTrack ref={trackRef} trackPx={trackPx} />}
        </div>
    );
}

/**
 * The scroll track: distance, nothing more.
 *
 * Empty by design — every visible layer is fixed, and this spacer's only job is to give
 * the document something to scroll through. `useSectionSnap` is what turns that scroll into
 * one jump per stop rather than letting the visitor scroll it by hand.
 */
function JourneyTrack({ ref, trackPx }: { ref: React.Ref<HTMLDivElement>; trackPx: number }) {
    return <div ref={ref} aria-hidden style={{ height: trackPx }} />;
}

/**
 * Reveals `text` one character at a time as `t` rises through its docking window - the
 * reference's own per-letter cascade (its headings split into one span per character),
 * closer and busier than revealing a word at a time. Characters keep their final position
 * throughout (layout never shifts, nothing reflows); only opacity and a small rise animate.
 * Each word is still one `inline-block` so the cascade never splits a word across lines -
 * same wrapping trick the word-level version used, just with character spans inside it
 * instead of the word's own text.
 *
 * `startIndex`/`totalChars` let two calls - a heading's italic lead and its plain rest -
 * share one staggered cascade rather than each restarting its own.
 *
 * Defaults to fully shown (`t = 1`): the reduced-motion page states every heading plainly,
 * and a heading rendered with no `t` at all - nothing here currently does, but nothing
 * should silently blank itself if something someday does - should read, not disappear.
 */
function RevealChars({
    text,
    t = 1,
    startIndex = 0,
    totalChars,
}: {
    text: string;
    t?: number;
    startIndex?: number;
    totalChars?: number;
}) {
    const words = text.split(' ');
    const total = Math.max(1, (totalChars ?? text.replace(/ /g, '').length) - 1);
    let index = startIndex;
    const nodes: React.ReactNode[] = [];
    words.forEach((w, wi) => {
        const chars = Array.from(w).map((ch, ci) => {
            const start = ((index + ci) / total) * 0.015;
            const reveal = ramp(t, start, start + 0.02);
            return (
                <span key={ci} className="inline-block" style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 12}px)` }}>
                    {ch}
                </span>
            );
        });
        index += w.length;
        nodes.push(<span key={wi} className="inline-block">{chars}</span>);
        if (wi < words.length - 1) nodes.push(' ');
    });
    return <>{nodes}</>;
}

/**
 * The hero's departure, shared by every stage: each line moves at its own speed, and the two
 * halves of a heading drift in opposite directions, so a section comes apart as the next one
 * arrives rather than dimming in place.
 *
 * `shift` is how far the stage is from sitting still: positive while it is arriving (offset
 * below its resting place), negative while it is leaving (offset above it), 0 when docked.
 * Both directions follow the scroll, so scrolling back plays it in reverse. Returns nothing
 * at rest — a transform, even a zero one, would make the element the containing block for
 * the search dropdowns, which dock themselves to the viewport on a phone.
 */
function drift(shift: number, x: number, y: number): React.CSSProperties | undefined {
    return shift === 0 ? undefined : { transform: `translate(${x * shift}px, ${y * shift}px)` };
}

/** Pixels each part of a stage travels per unit of `shift`. Later lines travel further. */
const DRIFT = { eyebrow: [0, 36], lead: [64, 70], rest: [-64, 110], caption: [0, 150], surface: [0, 190] } as const;

function StageHeading({ stage, t, shift = 0, docked = false }: {
    stage: StageFace;
    t?: number;
    shift?: number;
    /** On the docked stage, whose whole search has to fit one screen: the caption is the first
     *  thing a short phone (under 700px tall) gives up so the pills stay clear of the bottom nav. */
    docked?: boolean;
}) {
    const tAll = useTranslations();
    // A stage's wording is in the message files, keyed by its id (see `StageFace.id`).
    const key = (field: 'eyebrow' | 'titleLead' | 'titleRest' | 'caption') =>
        `landing.journey.stages.${stage.id}.${field}`;
    const copy = (field: Parameters<typeof key>[0]) => tAll(key(field));
    // Optional: the search stage dropped its numbered "STAGE 01 · HOTELS" label, so only a
    // stage that still has an eyebrow in the message files (the closing one) shows one.
    const eyebrow = tAll.has(key('eyebrow')) ? copy('eyebrow') : null;
    const lead = copy('titleLead');
    const rest = copy('titleRest');
    const leadChars = lead.replace(/ /g, '').length;
    const totalChars = leadChars + rest.replace(/ /g, '').length;
    return (
        <div>
            {eyebrow && (
                <p
                    className="mb-4 text-[11px] tracking-[0.3em] uppercase"
                    style={{ color: BRAND.accent, ...drift(shift, ...DRIFT.eyebrow) }}
                >
                    {eyebrow}
                </p>
            )}
            {/* The hero's own treatment — bold, uppercase, tight tracking — rather than
                the semibold mixed-case it used to carry, so every heading in the Journey
                reads in one voice instead of the hero sounding like a different page. */}
            {/* 36px from a 375px phone up, as before; narrower than that it shrinks with the
                screen, so "FIND YOUR STAY." stays one line on a 320px phone. */}
            <h2 className="text-[clamp(1.75rem,9.6vw,2.25rem)] leading-[0.9] font-bold tracking-tight text-white uppercase sm:text-5xl">
                <span className="inline-block" style={drift(shift, ...DRIFT.lead)}>
                    <RevealChars text={lead} t={t} totalChars={totalChars} />
                </span>{' '}
                <span className="inline-block" style={drift(shift, ...DRIFT.rest)}>
                    <RevealChars text={rest} t={t} startIndex={leadChars} totalChars={totalChars} />
                </span>
            </h2>
            <p
                className={`mt-3 max-w-md text-sm text-white/65 ${docked ? 'max-lg:[@media(max-height:700px)]:hidden' : ''}`}
                style={drift(shift, ...DRIFT.caption)}
            >
                {copy('caption')}
            </p>
        </div>
    );
}

/**
 * The real product surface a stage is about.
 *
 * Memoised: its props do not change while the visitor scrolls, but its parent re-renders on
 * every scroll frame, and re-rendering a full search bar sixty times a second through a glide
 * is the most expensive thing the page does.
 */
const StageSurface = memo(function StageSurface({
    stage,
    trending,
    stays,
    onModeSelect,
}: {
    stage: StageFace;
    trending?: TrendingDest[];
    stays: Record<string, FeaturedStay>;
    /** Absent in the reduced-motion page, where the pills keep switching in place. */
    onModeSelect?: (mode: SearchMode) => void;
}) {
    if (stage.id === 'stays') {
        return <StaysSurface trending={trending} stays={stays} onModeSelect={onModeSelect} />;
    }
    if (stage.id === 'flights') {
        return <ImmersiveSearchBar trendingDestinations={trending} defaultMode="flights" onModeSelect={onModeSelect} />;
    }
    if (stage.id === 'golf') {
        return <GolfSurface onModeSelect={onModeSelect} />;
    }
    if (stage.id === 'ai') {
        return <AskPanel />;
    }
    return <OptionsPanel />;
});

/**
 * The stay search with the city pills under it. A pill hands its city to the search bar, and
 * the bar reports back the destination its sentence holds, so the lit pill is always the one the
 * search will run — including after the visitor picks some other city from the dropdown.
 */
function StaysSurface({
    trending,
    stays,
    onModeSelect,
}: {
    trending?: TrendingDest[];
    stays: Record<string, FeaturedStay>;
    onModeSelect?: (mode: SearchMode) => void;
}) {
    // A fresh object per click, so picking the same pill again still reaches the bar.
    const [pick, setPick] = useState<{ name: string } | null>(null);
    const [destination, setDestination] = useState<string | null>(null);
    return (
        // A flex gap, not `space-y-*`: that spaces by margin, and the bar's root carries an
        // inline `margin: 0 auto` that outranks it, so GO and the pills ended up touching.
        // Only up to 640px, where the bar drops its own padding (`--imm-pad:0px` in
        // immersive-search-bar): above that, the padding under GO is already the gap.
        <div className="flex flex-col gap-4 min-[641px]:gap-0">
            <ImmersiveSearchBar
                trendingDestinations={trending}
                defaultMode="stays"
                onModeSelect={onModeSelect}
                destinationPick={pick}
                onDestinationChange={setDestination}
            />
            <ShowcaseStrip stays={stays} chosen={destination} onPick={city => setPick({ name: city })} />
        </div>
    );
}

/**
 * The golf search with the course pills under it — Stays' arrangement, for golf. The catalogue is
 * asked for here, once, and handed to both, so the pills and the sentence's dropdown are the same
 * list; it is asked for only when the Golf face is first shown, since this mounts with it.
 */
function GolfSurface({ onModeSelect }: { onModeSelect?: (mode: SearchMode) => void }) {
    const courses = useGolfCourses();
    // A fresh object per click, so picking the same pill again still reaches the bar.
    const [pick, setPick] = useState<{ slug: string } | null>(null);
    const [chosen, setChosen] = useState<string | null>(null);
    return (
        // A flex gap, sized as StaysSurface's is and for the same reasons.
        <div className="flex flex-col gap-4 min-[641px]:gap-0">
            <ImmersiveSearchBar
                defaultMode="golf"
                onModeSelect={onModeSelect}
                golfCourses={courses}
                coursePick={pick}
                onCourseChange={setChosen}
            />
            <CourseStrip courses={courses} chosen={chosen} onPick={slug => setPick({ slug })} />
        </div>
    );
}

/** How many courses the strip under the golf search names, and how many of those a phone shows. */
const STRIP_COURSES = 4;
const PHONE_COURSES = 2;

/**
 * A few courses under the golf search, with what they cost to play — `ShowcaseStrip`'s job for golf.
 * Picking one fills the sentence's course, and the lit pill is always the course GO will open.
 *
 * The fee is api-v2's, already in the currency picked in the header and only a guide: unlike the
 * stays strip it is not converted here, because golf never converts in the browser. Nothing is
 * drawn when there are no courses — the sentence's own dropdown says so, once.
 */
function CourseStrip({
    courses,
    chosen,
    onPick,
}: {
    courses: GolfCourse[] | null;
    chosen: string | null;
    onPick: (slug: string) => void;
}) {
    const tAll = useTranslations();
    const glass = { background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}` };

    if (courses === null) {
        return (
            <div className={STRIP} aria-hidden>
                {Array.from({ length: STRIP_COURSES }, (_, i) => (
                    <span key={i} className={`${STRIP_PILL} h-11 animate-pulse sm:h-10 ${i >= PHONE_COURSES ? 'max-sm:hidden' : ''}`} style={glass} />
                ))}
            </div>
        );
    }
    if (courses.length === 0) return null;

    return (
        <div className={STRIP}>
            {courses.slice(0, STRIP_COURSES).map((c, i) => {
                const isChosen = chosen === c.slug;
                return (
                    <button
                        key={c.id}
                        type="button"
                        aria-pressed={isChosen}
                        onClick={() => onPick(c.slug)}
                        // A phone names two; the rest are a tap away in the sentence's own list.
                        className={`${STRIP_PILL} ${i >= PHONE_COURSES ? 'max-sm:hidden' : ''} cursor-pointer transition-[filter,transform] duration-150 hover:brightness-125 active:scale-95`}
                        style={{
                            background: isChosen ? BRAND.primaryWash : BRAND.glass,
                            border: `1px solid ${isChosen ? BRAND.accent : BRAND.glassBorder}`,
                        }}
                    >
                        <span className="truncate text-sm font-medium text-white">{c.name}</span>
                        {c.greenFeeFrom != null && (
                            <span className="truncate text-[11px] text-white/55 sm:ml-2 sm:text-xs">
                                {tAll('landing.journey.strip.from', { price: formatCurrency(c.greenFeeFrom, c.currency) })}
                            </span>
                        )}
                    </button>
                );
            })}
            {/* The grid's whole second row on a phone, under the two courses. */}
            <Link
                href="/golf"
                className={`${STRIP_PILL} col-span-2 items-center text-center text-sm font-medium text-white/80 transition-[filter] duration-150 hover:brightness-125`}
                style={glass}
            >
                {tAll('search.golf.allCourses')}
            </Link>
        </div>
    );
}

/**
 * The pills under the stays and golf searches. On a phone they are a two-column grid, each pill a
 * cell with its price under its name: as one-line capsules they ran one or two to a row, four rows
 * deep, down under the bottom bar. From `sm` up they are the capsules in a wrapping row they were.
 * `min-h-11` keeps a phone's pill a full 44px target even with no price under the name.
 */
const STRIP = 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap';
const STRIP_PILL =
    'flex min-h-11 min-w-0 flex-col justify-center rounded-2xl px-3.5 py-1.5 text-left ' +
    'sm:block sm:min-h-0 sm:min-w-36 sm:rounded-full sm:px-7 sm:py-2.5 sm:text-center';

/** How long the old wording takes to fade out before the new is put in its place, in ms. */
const FACE_SWAP_MS = 240;

/**
 * One stage, docked and animated against its own span.
 *
 * Keyed on stage id by the caller, so moving between stages unmounts the previous
 * surface — which is what keeps two search bars from fighting over the search store.
 *
 * A stage with several faces (Hotels, Flights, Golf) changes between them here, in place. The panel
 * slides to the side the new face docks on, and the wording and the search are swapped while
 * it is on the way: the old fade out, the new fade in, so there is never a frame of one face's
 * heading above the other's search. `shown` lags `mode` by the time that fade takes.
 */
function StagePanel({
    stage,
    mode,
    journey,
    trending,
    stays,
    onModeSelect,
    journeyRef,
}: {
    stage: Stage;
    mode: SearchMode;
    journey: number;
    trending?: TrendingDest[];
    stays: Record<string, FeaturedStay>;
    onModeSelect: (mode: SearchMode) => void;
    /** The Journey's root, whose bottom edge is the top of the page's footer. */
    journeyRef: React.RefObject<HTMLDivElement | null>;
}) {
    const t = stageProgress(stage, journey) ?? 0;
    const isLast = stage === STAGES[STAGES.length - 1];
    // The last stage stays where it lands; every other one moves off as the next arrives.
    const { shift, opacity } = stageMotion(t, isLast);

    const panelRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    useFooterClearance(isLast, journeyRef, panelRef, contentRef);

    const [shown, setShown] = useState(mode);
    useEffect(() => {
        if (shown === mode) return;
        const id = window.setTimeout(() => setShown(mode), FACE_SWAP_MS);
        return () => window.clearTimeout(id);
    }, [mode, shown]);
    const swapping = shown !== mode;

    const face = faceOf(stage, shown);
    // Where the panel is headed, which is the chosen face's side even while the old wording is
    // still fading out — so it is already moving when the new one arrives.
    const side = faceOf(stage, mode).side;
    const width = stage.side === 'center' ? 'min(100%, 56rem)' : 'min(100%, 42rem)';

    // Below `lg` the band the stage is centred in stops 152px above the foot of the screen: clear of
    // the bottom nav and of the floating buttons that ride above it at +92px (support chat, brand
    // preview), so neither lands on a pill. `items-center-safe`: a stage taller than its band on a
    // short phone starts under the header and runs down, rather than off the top.
    return (
        <div
            ref={panelRef}
            className="pointer-events-none fixed inset-0 z-[3] flex items-center-safe px-[max(1.5rem,6vw)] pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+152px)] lg:pb-0"
            style={{ opacity }}
        >
            {/* Positioned by its left margin, as a share of the room the panel leaves — 0 flush
                left, 1 flush right — because a margin can be transitioned and `left`/`right`
                cannot. The share is of the row's own width, so no measuring is needed. */}
            <div
                ref={contentRef}
                className="pointer-events-auto"
                style={{
                    width,
                    marginLeft: `calc((100% - ${width}) * ${SIDE_OFFSET[side]})`,
                    transition: 'margin-left 700ms cubic-bezier(0.65, 0, 0.35, 1)',
                }}
            >
                <div
                    style={{
                        opacity: swapping ? 0 : 1,
                        transition: `opacity ${FACE_SWAP_MS}ms ease`,
                        pointerEvents: swapping ? 'none' : undefined,
                    }}
                >
                    <StageHeading stage={face} t={t} shift={shift} docked />
                    <div className="mt-5 sm:mt-8" style={drift(shift, ...DRIFT.surface)}>
                        <StageSurface key={face.id} stage={face} trending={trending} stays={stays} onModeSelect={onModeSelect} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Room kept between the last stage and the footer once the footer starts pushing it up. */
const FOOTER_CLEARANCE_PX = 24;

/**
 * Keeps the last stage clear of the page's footer.
 *
 * The stage is a fixed layer and the footer is in flow under the scroll track, so scrolling
 * past the end of the journey brought the footer up underneath the stage's cards, with both
 * readable through each other. Once the footer's top edge comes within
 * `FOOTER_CLEARANCE_PX` of the stage's content, the stage moves up by exactly the overlap,
 * so from then on it scrolls with the page as if it had been in flow above the footer. Before
 * that, the footer rises into the empty band below the stage (the room a phone keeps for its
 * bottom nav) and nothing moves.
 *
 * The transform is written straight to the element on scroll rather than through state:
 * this runs every frame of a scroll, and re-rendering the stage's search for it would be waste.
 * The content's resting position is read from `offsetTop`/`offsetHeight`, which the transform
 * does not change, so the measurement never chases its own correction.
 */
function useFooterClearance(
    enabled: boolean,
    journeyRef: React.RefObject<HTMLDivElement | null>,
    panelRef: React.RefObject<HTMLDivElement | null>,
    contentRef: React.RefObject<HTMLDivElement | null>,
) {
    useEffect(() => {
        const panel = panelRef.current;
        const content = contentRef.current;
        if (!enabled || !panel || !content) return;

        let frame = 0;
        const update = () => {
            frame = 0;
            const end = journeyRef.current;
            if (!end) return;
            const footerTop = end.getBoundingClientRect().bottom;
            // The panel is fixed at the top of the viewport and is the content's offset parent,
            // so these offsets are viewport coordinates of where the content rests.
            const contentBottom = content.offsetTop + content.offsetHeight;
            const lift = Math.max(0, contentBottom + FOOTER_CLEARANCE_PX - footerTop);
            panel.style.transform = lift > 0 ? `translateY(${-lift}px)` : '';
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        // The stage changes height as its face swaps or a phone rotates.
        const observer = new ResizeObserver(schedule);
        observer.observe(content);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            observer.disconnect();
            panel.style.transform = '';
        };
    }, [enabled, journeyRef, panelRef, contentRef]);
}

/**
 * The four destinations moving behind this stage, with what they actually cost.
 *
 * It does two jobs. It tells the visitor the backdrop is inventory rather than stock
 * photography, and picking one fills the destination of the stay search above it — so the
 * scroll and the search stay the same object rather than two things happening near each other.
 * It used to write the city to the search store, which the bar never reads: the pill lit up
 * and the sentence, and the search GO ran, still said "somewhere amazing".
 *
 * A destination with no promoted stay still appears, just without a price. Empty
 * `hotel_deals` costs the strip its figures, never its destinations.
 */
function ShowcaseStrip({
    stays,
    chosen,
    onPick,
}: {
    stays: Record<string, FeaturedStay>;
    /** The destination the search will run, which lights its pill. */
    chosen: string | null;
    onPick: (city: string) => void;
}) {
    const tAll = useTranslations();
    // In the currency picked in the header, as every other price on the landing page is.
    const money = useMoney();

    return (
        <div className={STRIP}>
            {SHOWCASE_DESTINATIONS.map(d => {
                const stay = stays[d.city];
                const isChosen = chosen === d.city;
                return (
                    <button
                        key={d.city}
                        type="button"
                        aria-pressed={isChosen}
                        onClick={() => onPick(d.city)}
                        // `cursor-pointer` spelled out: Tailwind 4 leaves buttons on the
                        // default arrow, which made the pills look like labels.
                        className={`${STRIP_PILL} cursor-pointer transition-[filter,transform] duration-150 hover:brightness-125 active:scale-95`}
                        style={{
                            background: isChosen ? BRAND.primaryWash : BRAND.glass,
                            border: `1px solid ${isChosen ? BRAND.accent : BRAND.glassBorder}`,
                        }}
                    >
                        <span className="truncate text-sm font-medium text-white">{d.city}</span>
                        {stay && (
                            <span className="truncate text-[11px] text-white/55 sm:ml-2 sm:text-xs">
                                {tAll('landing.journey.strip.from', { price: money(stay.price, stay.currency) })}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * The AI stage. A prompt, not a chat: the conversation belongs on `/ai-chat`, and this
 * hands the question over rather than trying to answer it behind a backdrop.
 */
function AskPanel() {
    const tAll = useTranslations();
    const [value, setValue] = useState('');
    const examples = [1, 2, 3].map(n => tAll(`landing.journey.ask.example${n}`));

    return (
        <div
            className="rounded-2xl p-5 backdrop-blur-md"
            style={{ background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}` }}
        >
            <div className="flex items-center gap-3">
                <input
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={tAll('landing.journey.ask.placeholder')}
                    aria-label={tAll('landing.journey.ask.label')}
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/40"
                />
                <Link
                    href={`/ai-chat${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`}
                    className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110"
                    style={{ background: BRAND.gradient }}
                >
                    {tAll('landing.journey.ask.submit')}
                </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {examples.map(ex => (
                    <button
                        key={ex}
                        type="button"
                        onClick={() => setValue(ex)}
                        className="rounded-full px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
                        style={{ border: `1px solid ${BRAND.glassBorder}` }}
                    >
                        {ex}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** The last stage: every way in, side by side, for a visitor who skipped the rest. */
function OptionsPanel() {
    const tAll = useTranslations();
    const options: Array<{ href: string; label: string; note: string }> = [
        { href: '/search', label: tAll('landing.search.searchMode.stays'), note: tAll('landing.journey.options.staysNote') },
        { href: '/flights/search', label: tAll('landing.search.searchMode.flights'), note: tAll('landing.journey.options.flightsNote') },
        { href: '/golf', label: tAll('landing.journey.options.golf'), note: tAll('landing.journey.options.golfNote') },
    ];

    const card = 'rounded-2xl p-4 backdrop-blur-md';
    const glass = { background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}` };

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {options.map(o => {
                const body = (
                    <>
                        <p className="text-base font-semibold text-white">{o.label}</p>
                        <p className="mt-1 text-xs text-white/60">{o.note}</p>
                    </>
                );
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
            })}
        </div>
    );
}

/**
 * One digit of a mechanical counter: a strip of 0–9 sliding behind a one-line mask, always
 * framing whichever digit is current. Transitioning on every change rather than jumping is
 * what makes a number that updates every scroll frame read as a dial actually turning
 * rather than as text flickering.
 */
function OdometerDigit({ digit }: { digit: number }) {
    return (
        <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-bottom">
            <span
                className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-150 ease-out"
                style={{ transform: `translateY(${-digit * 10}%)` }}
            >
                {Array.from({ length: 10 }, (_, d) => (
                    <span key={d} className="block h-[1em] text-center leading-[1em]">
                        {d}
                    </span>
                ))}
            </span>
        </span>
    );
}

/** `value`, formatted and rolled digit by digit — commas and other non-digit characters
 *  pass through as plain text, unanimated. */
function Odometer({ value }: { value: number }) {
    return (
        <span className="inline-flex">
            {value
                .toLocaleString('en-US')
                .split('')
                .map((ch, i) =>
                    /\d/.test(ch) ? (
                        <OdometerDigit key={i} digit={Number(ch)} />
                    ) : (
                        <span key={i} className="inline-block">{ch}</span>
                    ),
                )}
        </span>
    );
}

/** Altitude the descent "starts" at — purely atmospheric, ties the copy's own "begin your
 *  descent" line to a number that lands on zero exactly where the Journey does. */
const ALTITUDE_START_FT = 38_000;

/**
 * Where the visitor is in the descent, read as altitude rather than a percentage — "ALT …
 * FT" counting down to zero at the end of the track, on the right edge as the reference has
 * it. Replaces the Boarding Pass: this tracks the descent itself, not an accumulating trip
 * summary — each stage's own search form is still the one way to act on it.
 *
 * `aria-hidden`: it reports scroll position, which a screen reader already conveys, and
 * announcing a number that changes on every frame would be unusable.
 */
function AltitudeReadout({ journey }: { journey: number }) {
    const tAll = useTranslations();
    const altitude = Math.round(ALTITUDE_START_FT * (1 - journey));
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed top-1/2 right-5 z-[2] hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
            style={{ opacity: ramp(journey, 0.04, 0.1) }}
        >
            <span className="flex items-baseline gap-[0.3em] text-[10px] tracking-[0.2em] text-white/45 tabular-nums uppercase">
                {tAll('landing.journey.altitude.label')} <Odometer value={altitude} /> {tAll('landing.journey.altitude.unit')}
            </span>
            <div className="relative h-32 w-px bg-white/15">
                <div
                    className="absolute top-0 left-0 w-px"
                    style={{ height: `${journey * 100}%`, background: BRAND.accent }}
                />
            </div>
        </div>
    );
}
