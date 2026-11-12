'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, MapPin, PlaneTakeoff, Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useSearchStore } from '@/shared/stores/search.store';
import { autocompleteDestinations, type DestinationSuggestion } from '@/features/search/api/destinations.api';
import { POPULAR_AIRPORTS } from '@/features/search/lib/popular-airports';
import { excludeOrigin } from '@/features/search/lib/exclude-origin';
import { isoDate } from '@/features/landing/lib/links';
import { nightsBetween } from '@/shared/lib/stay';
import { BRAND } from '@/shared/lib/palette';
import { CalendarGrid, FILL, fmtDate } from './prose-parts';

/**
 * The landing search, one question at a time — Claude Design's "Search Step by Step" (stays)
 * and "Flight Search Step by Step" (flights), drawn in the landing page's own language: the
 * glass the mode tabs sit on, the brand gradient on whatever is chosen or pressed, white type.
 *
 * Stays ask where, then when, then who. A flight asks first what kind of trip it is — one way
 * or round trip — then from, to, when and who. "From" arrives already answered — the airport
 * searched from last time, or the one for the page's language — so that step is a single tap.
 * Every step after the first has a Back button under it, to the step before, answers kept.
 *
 * Dates are optional, as they were in the sentence: both results pages pick dates when given
 * none, and say so. Days go into the URL as the local calendar has them (`isoDate`), never
 * through `toISOString`, which in Manila turns 12 December into the 11th.
 */

export type StepMode = 'stays' | 'flights';
type StepId = 'trip' | 'where' | 'from' | 'to' | 'when' | 'who';
type TripType = 'oneway' | 'roundtrip';

/** A city offered as a picture tile before anything is typed. */
export interface StayPick {
    city: string;
    countryCode: string;
    image: string;
    /** Already formatted, in the currency on show — "from ₩98,000". */
    price?: string;
}

/** Somewhere to stay, as the results page wants it: the name, and where it is if known. */
interface PickedPlace {
    name: string;
    id?: string;
    lat?: number;
    lng?: number;
    code?: string;
    rung?: string;
    bbox?: [number, number, number, number];
    districtName?: string;
    canonicalCity?: string;
}

const STEPS: Record<StepMode, StepId[]> = {
    stays:   ['where', 'when', 'who'],
    flights: ['trip', 'from', 'to', 'when', 'who'],
};

/** Where a flight leaves from before anyone says otherwise: the airport for the page's language. */
const HOME_AIRPORT: Record<string, string> = { ko: 'ICN', ja: 'NRT' };
const DEFAULT_AIRPORT = 'MNL';

/** How many rows a list shows: enough to choose from, few enough that the stage — heading, tabs,
 *  question, list and the button under it — still fits the screen it is docked on. */
const MAX_OPTIONS = 3;

/** "Manila (MNL)" → "Manila"; anything without a code is left alone. */
function cityOf(title: string): string {
    return title.replace(/\s*\([A-Z]{3}\)$/, '');
}
/** "Manila (MNL)" → "MNL", or nothing. */
function codeOf(title: string): string | undefined {
    return /\(([A-Z]{3})\)$/.exec(title)?.[1];
}
function homeAirport(locale: string): string {
    const code = HOME_AIRPORT[locale] ?? DEFAULT_AIRPORT;
    return POPULAR_AIRPORTS.find((a) => a.code === code)?.title ?? 'Manila (MNL)';
}

export function StepSearch({ mode, picks = [] }: { mode: StepMode; picks?: StayPick[] }) {
    const tAll = useTranslations();
    const t = useTranslations('search.steps');
    const locale = useLocale();
    const router = useRouter();
    const {
        setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment,
    } = useSearchStore();

    const steps = STEPS[mode];
    const [stepIndex, setStepIndex] = useState(0);
    const step = steps[stepIndex]!;

    // ── Answers ──────────────────────────────────────────────────────────────
    const [stay, setStay] = useState<PickedPlace | null>(null);
    const [origin, setOrigin] = useState<string>(() => homeAirport(locale));
    const [originTouched, setOriginTouched] = useState(false);
    const [destination, setDestinationAnswer] = useState<string | null>(null);
    /** Chosen on a flight's first step; nothing is assumed for it. */
    const [tripType, setTripType] = useState<TripType | null>(null);
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);

    // The airport searched from last time, once the browser's store is readable. After mount, so
    // the server and the first client render agree; and never over a choice already made here.
    const lastOrigin = useSearchStore((s) => s.flightState.flights[0]?.origin?.title ?? null);
    useEffect(() => {
        if (mode === 'flights' && lastOrigin && !originTouched) setOrigin(lastOrigin);
    }, [mode, lastOrigin, originTouched]);

    // ── The place field ──────────────────────────────────────────────────────
    const isPlaceStep = step === 'where' || step === 'from' || step === 'to';
    const [query, setQuery] = useState('');
    /** Typed by the visitor, rather than filled in from a pick: only that asks for suggestions. */
    const [typed, setTyped] = useState(false);
    const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [highlight, setHighlight] = useState(0);
    /** An option was taken: the list stays closed until the visitor types again. */
    const [picked, setPicked] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    /** Set when the visitor moves to a step whose field is still empty, so it takes the focus.
     *  Not on mount, and not for a field already answered (a "from" filled in for them, a step
     *  gone back to): the landing page should not open a phone's keyboard for nothing. */
    const focusOnArrive = useRef(false);

    /** The answer the current place step holds, as the field shows it. */
    const answerOf = useCallback((id: StepId): string => {
        if (id === 'where') return stay?.name ?? '';
        if (id === 'from') return origin;
        if (id === 'to') return destination ?? '';
        return '';
    }, [stay, origin, destination]);

    // Arriving at a step: its field shows its answer, and nothing is listed until typed. A step
    // the visitor already chose for keeps its list closed, unless they came back to change it.
    useEffect(() => {
        setQuery(answerOf(step));
        setTyped(false);
        setSuggestions([]);
        setHighlight(0);
        const chosen = step === 'from' ? originTouched : step === 'to' ? !!destination : step === 'where' ? !!stay : false;
        setPicked(chosen && !focusOnArrive.current);
        if (focusOnArrive.current && isPlaceStep) inputRef.current?.focus();
        focusOnArrive.current = false;
        // Only on arriving: `answerOf` changes as answers are picked, and that must not refill the field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const debounce = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => {
        clearTimeout(debounce.current);
        const q = query.trim();
        if (!typed || q.length < 2) { setSuggestions([]); setLoading(false); return; }
        setLoading(true);
        debounce.current = setTimeout(async () => {
            try {
                setSuggestions(await autocompleteDestinations(q, mode === 'flights' ? 'flights' : 'hotels'));
            } catch {
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 280);
        return () => clearTimeout(debounce.current);
    }, [query, typed, mode]);

    /** The other end of the flight, which this end can never be. */
    const otherEnd = step === 'to' ? origin : step === 'from' ? destination : null;
    const showTyped = typed && query.trim().length >= 2;
    const options: DestinationSuggestion[] = useMemo(() => {
        if (!isPlaceStep) return [];
        if (showTyped) return excludeOrigin(suggestions, otherEnd).slice(0, MAX_OPTIONS);
        // Before anything is typed a flight offers the airports most people fly; a stay offers tiles.
        if (mode === 'flights' && !picked) return excludeOrigin(POPULAR_AIRPORTS, otherEnd).slice(0, MAX_OPTIONS);
        return [];
    }, [isPlaceStep, showTyped, suggestions, otherEnd, mode, picked]);
    // Typed suggestions point at the best match; the default list at the answer the field holds,
    // if it is listed, and otherwise at nothing.
    useEffect(() => {
        setHighlight(showTyped ? 0 : options.findIndex((o) => o.title === answerOf(step)));
    }, [options, showTyped, answerOf, step]);

    const pickOption = useCallback((s: DestinationSuggestion) => {
        if (step === 'where') {
            const name = s.canonicalCity ?? s.title;
            setStay({ name, id: s.id, lat: s.lat, lng: s.lng, code: s.code, rung: s.rung, bbox: s.bbox, districtName: s.districtName, canonicalCity: s.canonicalCity });
            setQuery(name);
        } else if (step === 'from') {
            setOrigin(s.title);
            setOriginTouched(true);
            setQuery(s.title);
        } else if (step === 'to') {
            setDestinationAnswer(s.title);
            setQuery(s.title);
        }
        setTyped(false);
        setSuggestions([]);
        setPicked(true);
    }, [step]);

    const pickTile = useCallback((p: StayPick) => {
        setStay({ name: p.city });
        setQuery(p.city);
        setTyped(false);
    }, []);

    // ── Moving between steps ─────────────────────────────────────────────────
    const [shake, setShake] = useState(false);
    const shakeT = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(shakeT.current), []);

    /** To step `index`. `focus` says whether its field takes the focus; left out, an empty one does. */
    const goTo = useCallback((index: number, focus?: boolean) => {
        const target = steps[index];
        const place = target === 'where' || target === 'from' || target === 'to';
        focusOnArrive.current = focus ?? (place && !answerOf(target));
        setStepIndex(index);
    }, [steps, answerOf]);

    const answered = (id: StepId): boolean =>
        id === 'trip' ? !!tripType
        : id === 'where' ? !!stay : id === 'from' ? !!origin : id === 'to' ? !!destination : true;

    /** A different kind of trip asks for different dates: one, or a pair. */
    const chooseTrip = useCallback((tt: TripType) => {
        if (tt !== tripType) { setCheckIn(null); setCheckOut(null); }
        setTripType(tt);
    }, [tripType]);

    const [searching, startSearch] = useTransition();

    const runSearch = useCallback(() => {
        if (searching) return;
        let href: string;
        if (mode === 'stays' && stay) {
            setDestination({ title: stay.name, subtitle: '', type: 'city', countryCode: '', id: stay.id });
            if (checkIn) setDates({ checkIn, checkOut: checkOut ?? undefined });
            setTravelers({ adults, children });
            addRecentSearch({ title: stay.name, subtitle: '', type: 'city', countryCode: '', id: stay.id, lat: stay.lat, lng: stay.lng });
            setSearchMode('hotels');
            const params = new URLSearchParams({ destination: stay.name });
            if (checkIn)  params.set('checkIn', isoDate(checkIn));
            if (checkOut) params.set('checkOut', isoDate(checkOut));
            params.set('adults', String(adults));
            params.set('children', String(children));
            params.set('rooms', '1');
            if (stay.lat != null && stay.lng != null) { params.set('lat', String(stay.lat)); params.set('lng', String(stay.lng)); }
            if (stay.code)                params.set('destinationCode', stay.code);
            if (stay.rung)                params.set('rung', stay.rung);
            if (stay.bbox?.length === 4)  params.set('bbox', stay.bbox.join(','));
            if (stay.districtName)        params.set('districtName', stay.districtName);
            if (stay.canonicalCity)       params.set('canonicalCity', stay.canonicalCity);
            href = `/search?${params}`;
        } else if (mode === 'flights' && destination) {
            setSearchMode('flights');
            setFlightSegment(0, {
                origin:      { title: origin, subtitle: '', type: 'city', countryCode: '' },
                destination: { title: destination, subtitle: '', type: 'city', countryCode: '' },
                date: checkIn ?? null,
            });
            const params = new URLSearchParams({ origin, destination });
            if (checkIn) params.set('depart', isoDate(checkIn));
            params.set('tripType', tripType === 'roundtrip' ? 'round-trip' : 'one-way');
            params.set('cabin', 'economy');
            params.set('adults', String(adults));
            params.set('children', String(children));
            params.set('infants', '0');
            if (tripType === 'roundtrip' && checkOut) params.set('return', isoDate(checkOut));
            href = `/flights/search?${params}`;
        } else {
            return;
        }
        setIsSearching(true);
        startSearch(() => router.push(href));
    }, [searching, mode, stay, origin, destination, tripType, checkIn, checkOut, adults, children, router,
        setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment]);

    const next = useCallback(() => {
        if (!answered(step)) {
            setShake(true);
            clearTimeout(shakeT.current);
            shakeT.current = setTimeout(() => setShake(false), 450);
            inputRef.current?.focus();
            return;
        }
        if (stepIndex === steps.length - 1) { runSearch(); return; }
        goTo(stepIndex + 1);
        // `answered` reads the answers this render holds; listing it would only re-list them.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, stepIndex, steps.length, runSearch, goTo, tripType, stay, origin, destination]);

    // ── Dates ────────────────────────────────────────────────────────────────
    const oneWay = mode === 'flights' && tripType === 'oneway';
    const selectDay = useCallback((d: Date) => {
        if (oneWay) { setCheckIn(d); setCheckOut(null); return; }
        if (!checkIn || checkOut || d.getTime() <= checkIn.getTime()) { setCheckIn(d); setCheckOut(null); return; }
        setCheckOut(d);
    }, [oneWay, checkIn, checkOut]);
    const nights = nightsBetween(checkIn, checkOut);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setHighlight((h) => Math.min(options.length - 1, h + 1)); return; }
        if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        // A highlighted row is taken: a typed match, or a default the visitor arrowed onto. The
        // answer the field already holds is not taken again, so Enter on it is "next".
        const row = options[highlight];
        if (row && (showTyped || row.title !== answerOf(step))) { pickOption(row); return; }
        next();
    };

    // ── Words ────────────────────────────────────────────────────────────────
    const question = {
        trip:  t('askTrip'),
        where: t('askStay'),
        from:  t('askFrom'),
        to:    t('askTo'),
        when:  mode === 'flights' ? tAll('search.whenFlying') : t('askStayDates'),
        who:   mode === 'flights' ? tAll('checkout.flight.whosFlying') : tAll('landing.search.whosComing'),
    }[step];

    const nextStep = steps[stepIndex + 1];
    const isLast = !nextStep;
    const nextLabel = isLast
        ? (mode === 'flights' ? t('searchFlights') : t('searchStays'))
        : nextStep === 'when' ? t('nextDates')
        : nextStep === 'from' ? t('nextOrigin')
        : nextStep === 'to' ? t('nextDestination')
        : mode === 'flights' ? t('nextTravellers') : t('nextGuests');
    const searchingLabel = mode === 'flights' ? tAll('landing.search.searchingFlights') : tAll('landing.search.searchingStays');

    const tripLabel = (tt: TripType) => (tt === 'oneway' ? tAll('search.oneWay') : tAll('search.roundTrip'));
    const pickedName = isPlaceStep ? answerOf(step) : '';
    const enterHint = isPlaceStep && showTyped && options.length > 0;
    const hint = (() => {
        if (step === 'trip') return tripType ? t('selected', { name: tripLabel(tripType) }) : null;
        if (isPlaceStep) {
            if (enterHint) return mode === 'flights' ? t('enterHintAirport') : t('enterHintPlace');
            return pickedName ? t('selected', { name: pickedName }) : null;
        }
        if (step === 'when') {
            if (checkIn && checkOut) return `${fmtDate(checkIn)} → ${fmtDate(checkOut)}${nights ? ` · ${tAll('search.nights', { count: nights })}` : ''}`;
            if (checkIn) return oneWay ? fmtDate(checkIn) : `${fmtDate(checkIn)} → ?`;
            return t('datesOptional');
        }
        return null;
    })();

    const countryName = useMemo(() => {
        try {
            const names = new Intl.DisplayNames([locale], { type: 'region' });
            return (code: string) => names.of(code) ?? code;
        } catch {
            return (code: string) => code;
        }
    }, [locale]);

    const placeholder = mode === 'flights' ? tAll('search.cityAirportPlaceholder') : t('placePlaceholder');
    const noMatch = showTyped && !loading && options.length === 0
        ? (mode === 'flights' ? tAll('search.noAirportsMatch', { query: query.trim() }) : t('noPlaceMatch', { query: query.trim() }))
        : null;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="ss-root" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ss-gap,18px)', color: '#fff', width: '100%' }}>
            <style>{`
                @keyframes ssIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
                @keyframes ssShake { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)} }
                @keyframes ssSpin  { to{transform:rotate(360deg)} }
                .ss-body { animation:ssIn .2s ease-out }
                .ss-shake { animation:ssShake .42s ease }
                .ss-option { cursor:pointer }
                .ss-tile { transition:transform .15s ease, filter .15s ease }
                .ss-tile:hover { filter:brightness(1.1) }
                .ss-tile:active { transform:scale(.98) }
                .ss-next:not([aria-busy="true"]):hover { filter:brightness(.92) }
                .ss-next:active, .ss-back:active { transform:translateY(1px) }
                .ss-back:hover, .ss-change:hover { filter:brightness(1.2) }
                .ss-input::placeholder { color:rgba(255,255,255,.5) }
                .ss-input:focus { outline:none }
                @media (prefers-reduced-motion:reduce) { .ss-body, .ss-shake { animation:none } }
                /* A phone. The docked stage has to fit between the header and the bottom nav, so the
                   pieces tighten, the calendar's days with them; the line restating earlier answers
                   gives way on the later steps (the indicator's ticks say it); and the Enter hint,
                   which a touch keyboard has no use for, goes. */
                @media (max-width:640px) {
                  .ss-root { --ss-gap:10px; --ss-field-h:54px; --ss-field-size:16px; --ss-tile-h:84px; --ss-btn-h:48px; --ss-list-h:228px; --ss-row-pad:8px; --ss-cal-pad:10px; --ss-hint-size:13px; --ss-back-pad:0 16px; --ss-next-pad:0 20px; --ss-trip-pad:14px; --ss-tiles:repeat(2,minmax(0,1fr)); --imm-day-pad:2px; --imm-day-size:12px; --imm-month-btn:26px }
                  /* !important: both carry an inline display, which a stylesheet rule cannot otherwise beat. */
                  .ss-context-later, .ss-hint-enter { display:none !important }
                }
                /* A narrow phone keeps the one step being answered named; the rest are their numbers. */
                @media (max-width:420px) { .ss-step-label:not([data-current]) { display:none } }
            `}</style>

            {/* ── Where the visitor is in it ── */}
            <nav aria-label={t('navLabel')}>
                <ol style={{ display: 'flex', alignItems: 'center', gap: '10px', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'nowrap' }}>
                    {steps.map((id, i) => {
                        const done = i < stepIndex;
                        const current = i === stepIndex;
                        return (
                            <li key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                {i > 0 && <span aria-hidden style={{ width: 'clamp(12px,4vw,40px)', height: '1px', background: 'rgba(255,255,255,.2)', flexShrink: 0 }} />}
                                <button
                                    type="button"
                                    onClick={() => goTo(i)}
                                    disabled={!done}
                                    aria-current={current ? 'step' : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', padding: 0,
                                        fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
                                        color: current ? '#fff' : done ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.55)',
                                        cursor: done ? 'pointer' : 'default',
                                    }}
                                >
                                    <span aria-hidden style={{
                                        width: '24px', height: '24px', borderRadius: '999px', flexShrink: 0,
                                        display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, boxSizing: 'border-box',
                                        background: current ? FILL : done ? BRAND.primaryWash : 'transparent',
                                        border: current ? 'none' : done ? `1px solid ${BRAND.accent}` : '1px solid rgba(255,255,255,.3)',
                                        boxShadow: current ? BRAND.gradientShadow : 'none',
                                    }}>
                                        {done ? <Check size={13} strokeWidth={2.6} /> : i + 1}
                                    </span>
                                    <span className="ss-step-label" data-current={current || undefined}>{t(id)}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <div key={step} className="ss-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ss-gap,18px)' }}>
                {/* ── What is already answered, where it helps ── */}
                {mode === 'flights' && (step === 'to' || step === 'when' || step === 'who') && (
                    <div className={step === 'to' ? undefined : 'ss-context-later'} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '15px', color: 'rgba(255,255,255,.78)' }}>
                        <PlaneTakeoff size={18} aria-hidden />
                        <span>{t('fromOrigin', { city: cityOf(origin) })}</span>
                        {codeOf(origin) && <CodeBadge code={codeOf(origin)!} />}
                        {step === 'to' ? (
                            <button type="button" className="ss-change" onClick={() => goTo(steps.indexOf('from'), true)} style={{ border: 'none', background: 'none', padding: 0, marginLeft: '4px', color: BRAND.accent, fontWeight: 600, fontSize: '15px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {t('change')}
                            </button>
                        ) : destination && (
                            <>
                                <ArrowRight size={15} aria-hidden />
                                <span>{cityOf(destination)}</span>
                                {codeOf(destination) && <CodeBadge code={codeOf(destination)!} />}
                            </>
                        )}
                    </div>
                )}
                {mode === 'stays' && step !== 'where' && stay && (
                    <div className="ss-context-later" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: 'rgba(255,255,255,.78)' }}>
                        <MapPin size={18} aria-hidden />
                        <span>{stay.name}</span>
                    </div>
                )}

                <h3 style={{ margin: 0, fontSize: 'clamp(1.5rem,4.6vw,2.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, textWrap: 'balance' }}>
                    {question}
                </h3>

                {/* ── Where / from / to ── */}
                {isPlaceStep && (
                    <>
                        <div
                            className={shake ? 'ss-shake' : undefined}
                            style={{
                                width: '100%', maxWidth: '640px', borderRadius: '18px', overflow: 'hidden',
                                background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                                border: `1px solid ${query || shake ? 'rgba(96,165,250,.55)' : BRAND.glassBorder}`,
                                boxShadow: '0 24px 48px -12px rgba(0,0,0,.45)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 20px', height: 'var(--ss-field-h,62px)' }}>
                                <Search size={21} aria-hidden style={{ color: query ? BRAND.accent : 'rgba(255,255,255,.6)', flexShrink: 0 }} />
                                <input
                                    ref={inputRef}
                                    className="ss-input"
                                    role="combobox"
                                    aria-expanded={options.length > 0}
                                    aria-controls={listId}
                                    aria-activedescendant={options[highlight] ? `${listId}-${highlight}` : undefined}
                                    aria-autocomplete="list"
                                    aria-label={question}
                                    value={query}
                                    placeholder={placeholder}
                                    onChange={(e) => { setQuery(e.target.value); setTyped(true); setPicked(false); }}
                                    onKeyDown={onKeyDown}
                                    autoComplete="off"
                                    spellCheck={false}
                                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: '#fff', fontSize: 'var(--ss-field-size,19px)', fontFamily: 'var(--font-sans)' }}
                                />
                            </div>
                            {(options.length > 0 || noMatch) && (
                                <div style={{ borderTop: `1px solid ${BRAND.glassBorder}`, padding: '8px' }}>
                                    {noMatch ? (
                                        <div style={{ padding: '12px 14px', fontSize: '14px', color: 'rgba(255,255,255,.65)' }}>{noMatch}</div>
                                    ) : (
                                        <ul id={listId} role="listbox" aria-label={question} style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'var(--ss-list-h,320px)', overflowY: 'auto' }}>
                                            {options.map((s, i) => {
                                                const code = s.code ?? codeOf(s.title);
                                                const active = i === highlight;
                                                return (
                                                    <li
                                                        key={`${s.code ?? ''}${s.title}${i}`}
                                                        id={`${listId}-${i}`}
                                                        role="option"
                                                        aria-selected={active}
                                                        className="ss-option"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onMouseEnter={() => setHighlight(i)}
                                                        onClick={() => pickOption(s)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: 'var(--ss-row-pad,11px) 14px', borderRadius: '12px', background: active ? BRAND.primaryWash : 'transparent' }}
                                                    >
                                                        {mode === 'flights' && code ? <CodeBadge code={code} active={active} /> : null}
                                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                            <span style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {mode === 'flights' ? cityOf(s.title) : s.title}
                                                            </span>
                                                            {s.subtitle && (
                                                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subtitle}</span>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Picture tiles, for people still deciding — until something is typed. */}
                        {step === 'where' && !showTyped && picks.length > 0 && (
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: '10px' }}>
                                    {t('orPickOne')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'var(--ss-tiles,repeat(4,minmax(0,1fr)))', gap: '12px', maxWidth: '880px' }}>
                                    {picks.map((p) => {
                                        const chosen = stay?.name === p.city;
                                        return (
                                            <button
                                                key={p.city}
                                                type="button"
                                                className="ss-tile"
                                                aria-pressed={chosen}
                                                onClick={() => pickTile(p)}
                                                style={{
                                                    position: 'relative', height: 'var(--ss-tile-h,120px)', borderRadius: '16px', overflow: 'hidden',
                                                    border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: '#fff',
                                                    boxShadow: chosen ? `0 0 0 3px ${BRAND.accent}` : `inset 0 0 0 1px ${BRAND.glassBorder}`,
                                                }}
                                            >
                                                <Image src={p.image} alt="" fill sizes="(max-width: 640px) 45vw, 220px" style={{ objectFit: 'cover' }} />
                                                <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.78),transparent 62%)' }} />
                                                <span style={{ position: 'absolute', left: '12px', right: '12px', bottom: '10px', display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{p.city}</span>
                                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.82)' }}>{countryName(p.countryCode)}</span>
                                                    {p.price && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.7)' }}>{p.price}</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── When ── */}
                {/* ── One way, or round trip ── */}
                {step === 'trip' && (
                    <div
                        role="group"
                        aria-label={question}
                        className={shake ? 'ss-shake' : undefined}
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px', width: '100%', maxWidth: '560px' }}
                    >
                        {(['oneway', 'roundtrip'] as TripType[]).map((tt) => {
                            const chosen = tripType === tt;
                            const Icon = tt === 'oneway' ? ArrowRight : ArrowLeftRight;
                            return (
                                <button
                                    key={tt}
                                    type="button"
                                    className="ss-tile"
                                    aria-pressed={chosen}
                                    onClick={() => chooseTrip(tt)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px',
                                        padding: 'var(--ss-trip-pad,18px)', borderRadius: '18px', textAlign: 'left', cursor: 'pointer',
                                        color: '#fff', fontFamily: 'var(--font-sans)',
                                        background: chosen ? BRAND.primaryWash : 'rgba(2,6,23,.45)',
                                        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                                        border: `1px solid ${chosen ? BRAND.accent : BRAND.glassBorder}`,
                                        boxShadow: chosen ? `0 0 0 2px ${BRAND.accent}` : '0 24px 48px -12px rgba(0,0,0,.45)',
                                    }}
                                >
                                    <span aria-hidden style={{
                                        width: '36px', height: '36px', borderRadius: '12px', display: 'grid', placeItems: 'center',
                                        background: chosen ? FILL : 'rgba(255,255,255,.08)', boxShadow: chosen ? BRAND.gradientShadow : 'none',
                                    }}>
                                        <Icon size={18} />
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: '17px' }}>{tripLabel(tt)}</span>
                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.65)', lineHeight: 1.35 }}>
                                        {tt === 'oneway' ? t('oneWayNote') : t('roundTripNote')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {step === 'when' && (
                    <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ borderRadius: '18px', padding: 'var(--ss-cal-pad,16px)', background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BRAND.glassBorder}` }}>
                            <CalendarGrid checkIn={checkIn} checkOut={oneWay ? null : checkOut} onSelect={selectDay} accent={FILL} />
                        </div>
                    </div>
                )}

                {/* ── Who ── */}
                {step === 'who' && (
                    <div style={{ width: '100%', maxWidth: '400px', borderRadius: '18px', padding: '8px 18px', background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${BRAND.glassBorder}` }}>
                        {[
                            { label: tAll('landing.search.adults'),   sub: '18+',  val: adults,   set: setAdults,   min: 1, max: 16, fewer: t('fewerAdults'),   more: t('moreAdults') },
                            { label: tAll('landing.search.children'), sub: '0–17', val: children, set: setChildren, min: 0, max: 8,  fewer: t('fewerChildren'), more: t('moreChildren') },
                        ].map(({ label, sub, val, set, min, max, fewer, more }, i) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: i ? `1px solid ${BRAND.glassBorder}` : 'none' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{label}</div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.55)' }}>{sub}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <Stepper label={fewer} onClick={() => set((n: number) => Math.max(min, n - 1))} disabled={val <= min}>−</Stepper>
                                    <span aria-live="polite" style={{ fontSize: '18px', fontWeight: 800, minWidth: '22px', textAlign: 'center' }}>{val}</span>
                                    <Stepper label={more} onClick={() => set((n: number) => Math.min(max, n + 1))} disabled={val >= max}>+</Stepper>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── On ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
                {stepIndex > 0 && (
                    <button
                        type="button"
                        className="ss-back"
                        onClick={() => goTo(stepIndex - 1)}
                        style={{
                            height: 'var(--ss-btn-h,52px)', padding: 'var(--ss-back-pad,0 20px)', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '8px',
                            border: `1px solid ${BRAND.glassBorder}`, background: 'rgba(2,6,23,.35)', backdropFilter: 'blur(24px)',
                            color: 'rgba(255,255,255,.88)', fontWeight: 600, fontSize: '15px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                    >
                        <ArrowLeft size={17} aria-hidden />{t('back')}
                    </button>
                )}
                <button
                    type="button"
                    className="ss-next"
                    onClick={next}
                    aria-busy={searching}
                    aria-disabled={searching || undefined}
                    style={{
                        position: 'relative', height: 'var(--ss-btn-h,52px)', padding: 'var(--ss-next-pad,0 26px)', borderRadius: '9999px',
                        display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: FILL, color: '#fff',
                        boxShadow: '0 16px 30px -10px rgba(37,99,235,.55)', fontWeight: 700, fontSize: '15px',
                        cursor: searching ? 'progress' : 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                >
                    {searching ? (
                        <>
                            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'ssSpin .8s linear infinite' }}>
                                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
                                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                            </svg>
                            {searchingLabel}
                        </>
                    ) : isLast ? (
                        <><Search size={18} aria-hidden />{nextLabel}</>
                    ) : (
                        <>{nextLabel}<ArrowRight size={18} aria-hidden /></>
                    )}
                </button>
                {hint && <div aria-live="polite" className={enterHint ? 'ss-hint-enter' : undefined} style={{ color: 'rgba(255,255,255,.62)', fontSize: 'var(--ss-hint-size,14px)' }}>{hint}</div>}
            </div>
        </div>
    );
}

/** An airport's IATA code, as the flight lists have shown it on the landing page. */
function CodeBadge({ code, active = false }: { code: string; active?: boolean }) {
    return (
        <span style={{
            flexShrink: 0, minWidth: '46px', padding: '5px 0', borderRadius: '8px', textAlign: 'center',
            fontSize: '12px', fontWeight: 800, letterSpacing: '.06em', color: active ? BRAND.accent : '#fff',
            background: 'rgba(255,255,255,.1)', border: `1px solid ${BRAND.glassBorder}`,
        }}>{code}</span>
    );
}

function Stepper({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            style={{
                width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow,
                fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
            }}
        >{children}</button>
    );
}
