'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { formatCurrency } from '@/shared/lib/format';
import { useSearchStore } from '@/shared/stores/search.store';
import { ImmersiveSearchBar } from '@/features/search/components/immersive-search-bar';
import { isoDate, type TripDates } from '@/features/landing/lib/links';
import type { TrendingDest } from '@/features/search/components/immersive-search-bar';
import type { FeaturedStay } from '@/features/landing/api/featured.api';
import {
    HERO_FADE_END,
    SHOWCASE_DESTINATIONS,
    STAGES,
    currentStage,
    journeyBeats,
    ramp,
    stageProgress,
    type Stage,
} from './stages';
import { useJourneyProgress } from './useJourneyProgress';
import { StageShowcase } from './StageShowcase';
import { BoardingPass } from './BoardingPass';
import { buildPassState, type PassState } from './passState';

/** Nights the suggested trip assumes before the visitor says otherwise. */
const SUGGESTED_NIGHTS = 3;

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
    dates,
    trending,
    showcaseStays,
}: {
    dates: TripDates;
    trending?: TrendingDest[];
    /**
     * Promoted stay per showcase city, keyed by city name. Read from our own tables, never
     * from a supplier — see ADR 0005. Empty is an ordinary state: the strip then names the
     * destinations without quoting a price.
     */
    showcaseStays: Record<string, FeaturedStay>;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const { journey, exit, trackPx, reducedMotion } = useJourneyProgress(trackRef);

    // Snapping is switched on only while the Journey owns the screen. Left on the
    // document permanently it would also grab the search section and the footer below,
    // where there is nothing to snap to and the visitor is reading rather than travelling.
    useEffect(() => {
        if (reducedMotion) return;
        const on = exit < 1;
        document.documentElement.classList.toggle('journey-snap', on);
        return () => document.documentElement.classList.remove('journey-snap');
    }, [exit, reducedMotion]);

    // What the visitor has actually chosen, if anything. The pass prefers this over its
    // own suggestion the moment it exists — suggestion until touched, then theirs.
    const chosen = useSearchStore(s => s.destination);
    const storeDates = useSearchStore(s => s.dates);
    const flightState = useSearchStore(s => s.flightState);
    const [aiNote, setAiNote] = useState<string | null>(null);

    const pass: PassState = useMemo(() => {
        const s = SHOWCASE_DESTINATIONS[0];
        return buildPassState({
            chosen,
            dates: storeDates ?? null,
            // The flights stage writes its segment here, so the route is readable rather
            // than imaginary — it was previously hardcoded to null.
            firstFlight: flightState?.flights?.[0] ?? null,
            aiNote,
            suggested: { city: s.city, countryCode: s.countryCode, nights: SUGGESTED_NIGHTS },
            toIso: isoDate,
        });
    }, [chosen, aiNote, storeDates, flightState]);

    // Reduced motion: no track, no fixed layers, no choreography. The same stages, stated
    // in order as an ordinary page. Someone who asked for less motion still gets the product.
    if (reducedMotion) {
        return (
            <>
                <StageShowcase journey={0} reducedMotion />
                <div className="relative z-[1] mx-auto w-full max-w-5xl space-y-20 px-6 py-24">
                    {STAGES.map(stage => (
                        <section key={stage.id}>
                            <StageHeading stage={stage} />
                            <div className="mt-8">
                                <StageSurface stage={stage} trending={trending} onAiNote={setAiNote} stays={showcaseStays} />
                            </div>
                        </section>
                    ))}
                </div>
            </>
        );
    }

    const heroOpacity = 1 - ramp(journey, 0.02, HERO_FADE_END);
    const active = currentStage(journey);

    // Past the end of the track the Journey is over and the ordinary page takes the
    // screen. Without this every fixed layer stayed pinned over the search section
    // below — a stage panel and a search form rendering on top of each other.
    const left = 1 - exit;
    if (left <= 0.01) return <>{trackPx > 0 && <div aria-hidden style={{ height: trackPx }} />}</>;

    return (
        <div style={{ opacity: left }}>
            <StageShowcase journey={journey} reducedMotion={false} />

            {/* Hero. Fades rather than scrolls away, so the page's first movement is the
                product arriving, not the headline leaving. */}
            {heroOpacity > 0.01 && (
                <div
                    className="pointer-events-none fixed inset-0 z-[2] flex flex-col items-center justify-center px-6 text-center"
                    style={{ opacity: heroOpacity }}
                >
                    <p className="text-[11px] tracking-[0.4em] text-white/55 uppercase">
                        Hotels · Homes · Flights · Cars
                    </p>
                    <h1 className="mt-6 max-w-4xl text-5xl leading-[0.95] font-semibold text-white sm:text-7xl">
                        One search.
                        <br />
                        <span className="italic">Every way to go.</span>
                    </h1>
                    <p className="mt-6 max-w-md text-base text-white/70">
                        Scroll to build a trip — stays, flights and a plan — then search it.
                    </p>
                </div>
            )}

            <ScrollCue journey={journey} />
            <ProgressRail journey={journey} />

            {/* The docked stage: heading and the product surface it is about. Left-weighted,
                leaving the right for the pass, as the reference lays it out. */}
            {active && (
                <StagePanel
                    key={active.id}
                    stage={active}
                    journey={journey}
                    trending={trending}
                    onAiNote={setAiNote}
                    stays={showcaseStays}
                />
            )}

            {/* Opposite whichever side the stage took, so the two never share an edge.
                It keeps its place through the gaps between stages rather than drifting
                back and forth on nothing. */}
            <BoardingPass
                journey={journey}
                pass={pass}
                dates={dates}
                side={active?.side === 'left' ? 'right' : active?.side === 'right' ? 'left' : 'right'}
            />

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
 * The scroll track: distance, and the places the descent may come to rest.
 *
 * Empty of content by design — every visible layer is fixed. What it does carry is one
 * zero-height snap target per beat, positioned at that beat's scroll offset. With
 * `scroll-snap-type: y proximity` on the document, stopping near one settles onto it and
 * flicking past several is left alone, so the visitor never parks on a dissolve but is
 * never fought either.
 */
function JourneyTrack({ ref, trackPx }: { ref: React.Ref<HTMLDivElement>; trackPx: number }) {
    const beats = useMemo(() => journeyBeats(), []);
    return (
        <div ref={ref} aria-hidden className="relative" style={{ height: trackPx }}>
            {beats.map(b => (
                <div
                    key={b}
                    className="journey-beat absolute left-0 h-px w-px"
                    style={{ top: b * trackPx }}
                />
            ))}
        </div>
    );
}

function StageHeading({ stage }: { stage: Stage }) {
    return (
        <div>
            <p className="text-[11px] tracking-[0.3em] uppercase" style={{ color: BRAND.accent }}>
                {String(stage.index).padStart(2, '0')} · {stage.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                <span className="italic">{stage.titleLead}</span> {stage.titleRest}
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/65">{stage.caption}</p>
        </div>
    );
}

/** The real product surface a stage is about. */
function StageSurface({
    stage,
    trending,
    onAiNote,
    stays,
}: {
    stage: Stage;
    trending?: TrendingDest[];
    onAiNote: (note: string | null) => void;
    stays: Record<string, FeaturedStay>;
}) {
    if (stage.id === 'stays') {
        return (
            <div className="space-y-5">
                <ImmersiveSearchBar trendingDestinations={trending} defaultMode="stays" />
                <ShowcaseStrip stays={stays} />
            </div>
        );
    }
    if (stage.id === 'flights') {
        return <ImmersiveSearchBar trendingDestinations={trending} defaultMode="flights" />;
    }
    if (stage.id === 'ai') {
        return <AskPanel onAsk={onAiNote} />;
    }
    return <OptionsPanel />;
}

/**
 * One stage, docked and animated against its own span.
 *
 * Keyed on stage id by the caller, so moving between stages unmounts the previous
 * surface — which is what keeps two search bars from fighting over the search store.
 */
function StagePanel({
    stage,
    journey,
    trending,
    onAiNote,
    stays,
}: {
    stage: Stage;
    journey: number;
    trending?: TrendingDest[];
    onAiNote: (note: string | null) => void;
    stays: Record<string, FeaturedStay>;
}) {
    const t = stageProgress(stage, journey) ?? 0;
    // Settled for the middle of its span: a panel that moves the whole time is a panel
    // nobody can type into.
    const opacity = Math.min(ramp(t, 0, 0.12), 1 - ramp(t, 0.88, 1));
    const lift = (1 - ramp(t, 0, 0.12)) * 20;

    // Alternating sides, as the reference alternates its property cards. The panel slides
    // in from the side it will occupy, so the swap is something the visitor watches happen
    // rather than something they notice has already happened.
    const place =
        stage.side === 'right'
            ? 'right-0 justify-end lg:w-[58%]'
            : stage.side === 'center'
              ? 'inset-x-0 justify-center'
              : 'left-0 justify-start lg:w-[58%]';
    const slide = stage.side === 'right' ? 16 : stage.side === 'center' ? 0 : -16;

    return (
        <div
            className={`pointer-events-none fixed inset-y-0 z-[3] flex w-full items-center px-[max(1.5rem,6vw)] ${place}`}
            style={{
                opacity,
                transform: `translate(${slide * (1 - ramp(t, 0, 0.12))}px, ${lift}px)`,
            }}
        >
            <div
                className={`pointer-events-auto w-full ${stage.side === 'center' ? 'max-w-4xl' : 'max-w-2xl'}`}
            >
                <StageHeading stage={stage} />
                <div className="mt-8">
                    <StageSurface stage={stage} trending={trending} onAiNote={onAiNote} stays={stays} />
                </div>
            </div>
        </div>
    );
}

/**
 * The four destinations moving behind this stage, with what they actually cost.
 *
 * It does two jobs. It tells the visitor the backdrop is inventory rather than stock
 * photography, and picking one writes straight onto the Boarding Pass — so the scroll and
 * the pass stay the same object rather than two things happening near each other.
 *
 * A destination with no promoted stay still appears, just without a price. Empty
 * `hotel_deals` costs the strip its figures, never its destinations.
 */
function ShowcaseStrip({ stays }: { stays: Record<string, FeaturedStay> }) {
    const setDestination = useSearchStore(s => s.setDestination);
    const chosen = useSearchStore(s => s.destination);

    return (
        <div className="flex flex-wrap gap-2">
            {SHOWCASE_DESTINATIONS.map(d => {
                const stay = stays[d.city];
                const isChosen = chosen?.title === d.city;
                return (
                    <button
                        key={d.city}
                        type="button"
                        aria-pressed={isChosen}
                        onClick={() =>
                            setDestination({
                                type: 'city',
                                title: d.city,
                                subtitle: '',
                                countryCode: d.countryCode,
                            })
                        }
                        className="rounded-full px-4 py-2 text-left transition-[filter] duration-150 hover:brightness-125"
                        style={{
                            background: isChosen ? BRAND.primaryWash : BRAND.glass,
                            border: `1px solid ${isChosen ? BRAND.accent : BRAND.glassBorder}`,
                        }}
                    >
                        <span className="text-sm font-medium text-white">{d.city}</span>
                        {stay && (
                            <span className="ml-2 text-xs text-white/55">
                                from {formatCurrency(stay.price, stay.currency)}
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
function AskPanel({ onAsk }: { onAsk: (note: string | null) => void }) {
    const [value, setValue] = useState('');
    const examples = [
        'Five nights in Seoul under ₱40,000',
        'Beach, direct flight, leaving Friday',
        'Two cities in Japan, one week',
    ];

    return (
        <div
            className="rounded-2xl p-5 backdrop-blur-md"
            style={{ background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}` }}
        >
            <div className="flex items-center gap-3">
                <input
                    value={value}
                    onChange={e => {
                        setValue(e.target.value);
                        // Writes straight onto the pass: the visitor sees their own words
                        // land on the trip they are building, which is the whole point.
                        onAsk(e.target.value.trim() || null);
                    }}
                    placeholder="Describe the trip you want…"
                    aria-label="Describe the trip you want"
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/40"
                />
                <Link
                    href={`/ai-chat${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`}
                    className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110"
                    style={{ background: BRAND.gradient }}
                >
                    Ask
                </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {examples.map(ex => (
                    <button
                        key={ex}
                        type="button"
                        onClick={() => {
                            setValue(ex);
                            onAsk(ex);
                        }}
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
    const options = [
        { href: '/search', label: 'Stays', note: 'Hotels & homes' },
        { href: '/flights/search', label: 'Flights', note: 'Every carrier we reach' },
        { href: '/ai-chat', label: 'Ask AI', note: 'Plan it for me' },
        { href: '/deals', label: 'Deals', note: "This week's prices" },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {options.map(o => (
                <Link
                    key={o.href}
                    href={o.href}
                    className="rounded-2xl p-4 backdrop-blur-md transition-[filter] duration-150 hover:brightness-125"
                    style={{ background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}` }}
                >
                    <p className="text-base font-semibold text-white">{o.label}</p>
                    <p className="mt-1 text-xs text-white/60">{o.note}</p>
                </Link>
            ))}
        </div>
    );
}

function ScrollCue({ journey }: { journey: number }) {
    const opacity = 1 - ramp(journey, 0, 0.03);
    if (opacity <= 0.01) return null;
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-10 z-[2] flex justify-center"
            style={{ opacity }}
        >
            <span className="text-[11px] tracking-[0.3em] text-white/50 uppercase">Scroll</span>
        </div>
    );
}

/**
 * Where the visitor is in the descent, on the right edge as the reference has it.
 *
 * `aria-hidden`: it reports scroll position, which a screen reader already conveys, and
 * announcing a percentage that changes on every frame would be unusable.
 */
function ProgressRail({ journey }: { journey: number }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed top-1/2 right-5 z-[2] hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
            style={{ opacity: ramp(journey, 0.04, 0.1) }}
        >
            <span className="text-[10px] tracking-[0.2em] text-white/45 tabular-nums">
                {String(Math.round(journey * 100)).padStart(2, '0')}
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
