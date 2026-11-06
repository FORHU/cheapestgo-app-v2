'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchStore } from '@/shared/stores/search.store';
import { autocompleteDestinations } from '@/features/search/api/destinations.api';
import { POPULAR_AIRPORTS } from '@/features/search/lib/popular-airports';
import { excludeOrigin } from '@/features/search/lib/exclude-origin';
import { nightsBetween } from '@/shared/lib/stay';
import { BRAND } from '@/shared/lib/palette';
import { GolfSentence } from '@/features/golf/components/golf-sentence';
import type { GolfCourse } from '@/features/golf/types';
import {
    CalendarGrid, FILL, GRADIENT_TEXT, GoPill, NotePanel, PROSE, SearchMiniIcon, Slot, Token, fmtDate, leadingMark, useProseWidth,
} from './prose-parts';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'stays' | 'flights' | 'golf';
type TripType = 'oneway' | 'roundtrip';
type PanelType = 'origin' | 'destination' | 'dates' | 'travelers' | null;

interface DestSuggestion {
    // 'airport' is what flights mode actually returns. It was missing here and
    // went unnoticed only because the suggestions arrived as untyped JSON.
    type: 'city' | 'country' | 'airport';
    title: string;
    subtitle: string;
    countryCode: string;
    id?: string;
    lat?: number;
    lng?: number;
    code?: string;
    rung?: string;
    bbox?: [number, number, number, number];
    districtName?: string;
    canonicalCity?: string;
}

export interface TrendingDest {
    id: string;
    name: string;
    country: string;
    tag: string;
    bgClass: string;
    lat?: number | null;
    lng?: number | null;
    countryCode?: string;
    imageUrl?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRENDING: TrendingDest[] = [
    { id: 'bali',      name: 'Bali',      country: 'Indonesia', tag: 'Island escape',  bgClass: 'bg-gradient-to-br from-teal-500 to-emerald-700', lat: -8.4095,  lng: 115.1889,  countryCode: 'ID' },
    { id: 'santorini', name: 'Santorini', country: 'Greece',    tag: 'Coastal cliffs', bgClass: 'bg-gradient-to-br from-blue-400 to-sky-700',    lat:  36.3932,  lng:  25.4615,  countryCode: 'GR' },
    { id: 'kyoto',     name: 'Kyoto',     country: 'Japan',     tag: 'Culture & calm', bgClass: 'bg-gradient-to-br from-pink-400 to-rose-700',   lat:  35.0116,  lng: 135.7681,  countryCode: 'JP' },
    { id: 'marrakech', name: 'Marrakech', country: 'Morocco',   tag: 'Desert warmth',  bgClass: 'bg-gradient-to-br from-amber-400 to-orange-700', lat:  31.6295,  lng:  -7.9811,  countryCode: 'MA' },
];

const FLEX_CHIPS =['Weekend getaway', 'One week', 'Two weeks', 'Flexible / anytime'];

// ─── Shared SVGs ─────────────────────────────────────────────────────────────

/** An airport's IATA code, where a city row has its search glyph. */
function CodeBadge({ code }: { code: string }) {
    return (
        <span style={{
            flexShrink: 0, minWidth: '46px', padding: '5px 0', borderRadius: '8px', textAlign: 'center',
            fontSize: '12px', fontWeight: 800, letterSpacing: '.06em', color: '#fff',
            background: 'rgba(255,255,255,.1)', border: `1px solid ${BRAND.glassBorder}`,
        }}>{code}</span>
    );
}

function ClockMiniIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </svg>
    );
}

// ─── Destination search panel (shared between origin + dest) ─────────────────

interface DestPanelProps {
    query: string;
    onQueryChange: (v: string) => void;
    suggestions: DestSuggestion[];
    sugLoading: boolean;
    onPickSuggestion: (s: DestSuggestion) => void;
    trending?: TrendingDest[];
    onPickTrending?: (t: TrendingDest) => void;
    /** Flights mode: airports to offer before anything is typed, in place of the cards. */
    airports?: DestSuggestion[];
    /** Flights mode: what to say when a typed query finds no airport. */
    noMatchLabel?: string;
    recentDestinations?: Array<{ title: string; lat?: number; lng?: number }>;
    onPickRecent?: (title: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    trendingLabel?: string;
}

function DestPanel({
    query, onQueryChange, suggestions, sugLoading,
    onPickSuggestion, trending = [], onPickTrending,
    recentDestinations = [], onPickRecent, airports, noMatchLabel,
    placeholder = 'Search cities, countries, anywhere…',
    trendingLabel = 'Trending right now',
}: DestPanelProps) {
    const tAll = useTranslations();
    const showSuggestions = query.trim().length >= 2 && suggestions.length > 0;
    const showRecent = !query.trim() && recentDestinations.length > 0 && onPickRecent;
    const showTrending = trending.length > 0 && !!onPickTrending;
    const showAirports = !!airports?.length && query.trim().length < 2;
    const showNoMatch  = !!noMatchLabel && query.trim().length >= 2 && !sugLoading && suggestions.length === 0;
    const sectionLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.42)', marginBottom: '10px' };

    // One row for a typed result and a popular airport alike. An airport leads with its
    // code; the title drops the "(KIX)" it carries for the token, since the badge says it.
    const row = (s: DestSuggestion, key: React.Key) => (
        <div key={key} className="imm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer' }} onClick={() => onPickSuggestion(s)}>
            {s.code
                ? <CodeBadge code={s.code} />
                : <span style={{ display: 'flex', color: 'rgba(241,245,249,0.42)', flexShrink: 0 }}><SearchMiniIcon /></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.code ? s.title.replace(/\s*\([A-Z]{3}\)$/, '') : s.title}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.6)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.subtitle}</div>
            </div>
        </div>
    );

    return (
        <>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1.5px solid rgba(255,255,255,0.14)', paddingBottom: '10px', marginBottom: '18px' }}>
                <span style={{ display: 'flex', color: 'rgba(241,245,249,0.42)', flexShrink: 0 }}><SearchMiniIcon /></span>
                <input
                    type="text"
                    value={query}
                    onChange={e => onQueryChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', flex: 1, color: '#f1f5f9', fontFamily: 'var(--font-sans)' }}
                />
                {sugLoading && (
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'immSbSpin .8s linear infinite', flexShrink: 0, opacity: 0.5 }}>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                        <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                    </svg>
                )}
            </div>

            {/* API suggestions */}
            {showSuggestions && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '18px' }}>
                    {suggestions.map((s, i) => row(s, i))}
                </div>
            )}

            {showNoMatch && (
                <div style={{ fontSize: '13px', color: 'rgba(241,245,249,0.6)', padding: '4px 10px 14px' }}>{noMatchLabel}</div>
            )}

            {/* Popular airports — flights mode's starting list */}
            {showAirports && (
                <>
                    <div style={sectionLabel}>{trendingLabel}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {airports!.map(a => row(a, a.code!))}
                    </div>
                </>
            )}

            {/* Recent searches */}
            {showRecent && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.42)', marginBottom: '10px' }}>
                        {tAll('landing.recentlyViewed.subtitle')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
                        {recentDestinations.slice(0, 3).map((dest, i) => (
                            <div key={i} className="imm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer' }} onClick={() => onPickRecent!(dest.title, dest.lat, dest.lng)}>
                                <span style={{ display: 'flex', color: 'rgba(241,245,249,0.42)', flexShrink: 0 }}><ClockMiniIcon /></span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dest.title}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Trending */}
            {showTrending && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.42)', marginBottom: '10px' }}>
                        {trendingLabel}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                        {trending.map(dest => (
                            <div key={dest.id} className="imm-dest-card" style={{ flex: '1 1 120px', cursor: 'pointer', transition: 'opacity .2s' }} onClick={() => onPickTrending!(dest)}>
                                <div
                                    className={dest.bgClass}
                                    style={{
                                        width: '100%', height: '80px', marginBottom: '8px', borderRadius: '14px',
                                        ...(dest.imageUrl ? { backgroundImage: `url(${dest.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                                    }}
                                />
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>{dest.name}</div>
                                <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.6)' }}>{dest.country} · {dest.tag}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImmersiveSearchBar({
    trendingDestinations,
    defaultMode = 'stays',
    onModeSelect,
    destinationPick,
    onDestinationChange,
    golfCourses,
    coursePick,
    onCourseChange,
}: {
    trendingDestinations?: TrendingDest[];
    /**
     * Golf's courses, for its sentence: `null` while loading, `[]` for none. Left out, the golf
     * sentence asks for them itself — the case for a bar switched to Golf in place, which nobody
     * handed a catalogue.
     */
    golfCourses?: GolfCourse[] | null;
    /** A course chosen outside the bar — the landing page's course pills. */
    coursePick?: { slug: string } | null;
    /** Told which course the golf sentence holds, so the pill for it can light. */
    onCourseChange?: (slug: string | null) => void;
    /**
     * A destination chosen outside the bar — the landing page's city pills. Each new pick fills
     * the destination token as a dropdown pick would. The bar keeps its sentence in its own
     * state, so this is the way in: writing the city to the search store changed nothing here.
     */
    destinationPick?: { name: string } | null;
    /** Told what the sentence's destination is whenever it changes, null for none — so pills
     *  outside the bar can light the one the search will actually run. */
    onDestinationChange?: (name: string | null) => void;
    /**
     * When given, picking another tab calls this instead of switching in place. The landing
     * Journey uses it to slide its panel to that tab's face, whose own bar opens on that mode.
     */
    onModeSelect?: (mode: Mode) => void;
    /**
     * Which tab the bar opens on. The landing Journey mounts one bar per face — stays,
     * flights, golf — and each pins the mode it is about. The tabs still work.
     */
    defaultMode?: Mode;
}) {
    const tAll = useTranslations();
    const activeTrending = trendingDestinations?.length ? trendingDestinations : TRENDING;
    const router = useRouter();
    const { recentSearches, setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment } = useSearchStore();

    // Mode
    const [mode, setMode] = useState<Mode>(defaultMode);
    const [tripType, setTripType] = useState<TripType>('oneway');

    // Panel
    const [panelOpen, setPanelOpen] = useState<PanelType>(null);

    // Origin (flights only)
    const [originQuery, setOriginQuery] = useState('');
    const [originSugs, setOriginSugs] = useState<DestSuggestion[]>([]);
    const [originSugLoading, setOriginSugLoading] = useState(false);
    const [pickedOrigin, setPickedOrigin] = useState<{ name: string } | null>(null);

    // Destination
    const [destQuery, setDestQuery] = useState('');
    const [destSugs, setDestSugs] = useState<DestSuggestion[]>([]);
    const [destSugLoading, setDestSugLoading] = useState(false);
    const [pickedDest, setPickedDest] = useState<{ name: string; id?: string; lat?: number; lng?: number; code?: string; rung?: string; bbox?: [number, number, number, number]; districtName?: string; canonicalCity?: string } | null>(null);

    // Dates
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [flexible, setFlexible] = useState(false);
    const [flexOption, setFlexOption] = useState<string | null>(null);

    // Travelers
    const [adults,   setAdults]   = useState(2);
    const [children, setChildren] = useState(0);

    // UX
    // Pending from GO until the results page has rendered: the push runs in a transition, so
    // the button keeps its loading state for the whole wait rather than for a fixed delay.
    const [searching, startSearch] = useTransition();
    const [shake, setShake] = useState(false);
    const [hint, setHint] = useState(true);

    // Refs
    const wrapRef  = useRef<HTMLDivElement>(null);
    const proseRef = useRef<HTMLDivElement>(null);
    const shakeT   = useRef<ReturnType<typeof setTimeout>>();
    const advanceT = useRef<ReturnType<typeof setTimeout>>();
    const hintT    = useRef<ReturnType<typeof setTimeout>>();
    const origSugT = useRef<ReturnType<typeof setTimeout>>();
    const destSugT = useRef<ReturnType<typeof setTimeout>>();


    // ── Lifecycle ────────────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            // On a phone the open panel is a sheet in <body>, outside this wrapper; a press in it
            // is still a press in the bar.
            if ((e.target as Element).closest?.('.imm-note')) return;
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setPanelOpen(null);
            }
        };
        document.addEventListener('mousedown', handler);
        hintT.current = setTimeout(() => setHint(false), 6000);
        return () => {
            document.removeEventListener('mousedown', handler);
            [hintT, shakeT, advanceT, origSugT, destSugT].forEach(r => clearTimeout(r.current));
        };
    }, []);

    // ── Autocomplete ─────────────────────────────────────────────────────────

    useEffect(() => {
        clearTimeout(origSugT.current);
        const q = originQuery.trim();
        if (q.length < 2) { setOriginSugs([]); return; }
        setOriginSugLoading(true);
        const acMode = mode === 'flights' ? 'flights' : 'hotels';
        origSugT.current = setTimeout(async () => {
            try {
                setOriginSugs((await autocompleteDestinations(q, acMode)).slice(0, 6));
            } catch { setOriginSugs([]); }
            finally { setOriginSugLoading(false); }
        }, 280);
    }, [originQuery, mode]);

    useEffect(() => {
        clearTimeout(destSugT.current);
        const q = destQuery.trim();
        if (q.length < 2) { setDestSugs([]); return; }
        setDestSugLoading(true);
        const acMode = mode === 'flights' ? 'flights' : 'hotels';
        destSugT.current = setTimeout(async () => {
            try {
                // Kept whole: the origin is dropped from it at render, and the six
                // shown are counted after that, not before.
                setDestSugs(await autocompleteDestinations(q, acMode));
            } catch { setDestSugs([]); }
            finally { setDestSugLoading(false); }
        }, 280);
    }, [destQuery, mode]);

    // ── Mode switch ──────────────────────────────────────────────────────────

    const handleSetMode = useCallback((m: Mode) => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onModeSelect) {
            if (m !== mode) onModeSelect(m);
            return;
        }
        clearTimeout(advanceT.current);
        setMode(m);
        setPanelOpen(null);
        setCheckIn(null);
        setCheckOut(null);
        setFlexOption(null);
        setFlexible(false);
    }, [onModeSelect, mode]);

    // ── Panel toggle ─────────────────────────────────────────────────────────

    const openPanel = useCallback((name: PanelType) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setPanelOpen(p => p === name ? null : name);
        setHint(false);
    }, []);

    // ── Origin picks ─────────────────────────────────────────────────────────

    const pickOriginSuggestion = useCallback((s: DestSuggestion) => {
        clearTimeout(advanceT.current);
        setPickedOrigin({ name: s.title });
        setOriginQuery('');
        setOriginSugs([]);
        setPanelOpen('destination');
    }, []);

    // ── Destination picks ────────────────────────────────────────────────────

    const pickDestTrending = useCallback((t: TrendingDest) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: t.name, lat: t.lat ?? undefined, lng: t.lng ?? undefined });
        setDestQuery('');
        setDestSugs([]);
        setPanelOpen('dates');
    }, []);

    const pickDestSuggestion = useCallback((s: DestSuggestion) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: s.canonicalCity ?? s.title, id: s.id, lat: s.lat, lng: s.lng, code: s.code, rung: s.rung, bbox: s.bbox, districtName: s.districtName, canonicalCity: s.canonicalCity });
        setDestQuery('');
        setDestSugs([]);
        setPanelOpen('dates');
    }, []);

    const pickDestRecent = useCallback((title: string, lat?: number, lng?: number) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: title, lat, lng });
        setDestQuery('');
        setPanelOpen('dates');
    }, []);

    // A pick from outside fills the token without opening the dates: the pills sit under the
    // GO button, and a calendar opening over them would hide the button the visitor reaches for.
    useEffect(() => {
        if (!destinationPick) return;
        clearTimeout(advanceT.current);
        setPickedDest({ name: destinationPick.name });
        setDestQuery('');
        setPanelOpen(null);
    }, [destinationPick]);

    useEffect(() => {
        onDestinationChange?.(pickedDest?.name ?? null);
    }, [pickedDest, onDestinationChange]);

    // ── Date selection ───────────────────────────────────────────────────────

    const selectDay = useCallback((d: Date) => () => {
        if (mode === 'flights' && tripType === 'oneway') {
            setCheckIn(d);
            setCheckOut(null);
            clearTimeout(advanceT.current);
            advanceT.current = setTimeout(() => setPanelOpen('travelers'), 450);
            return;
        }
        if (!checkIn || checkOut) {
            setCheckIn(d);
            setCheckOut(null);
            return;
        }
        if (d.getTime() > checkIn.getTime()) {
            setCheckOut(d);
            clearTimeout(advanceT.current);
            advanceT.current = setTimeout(() => setPanelOpen('travelers'), 550);
        } else {
            setCheckIn(d);
            setCheckOut(null);
        }
    }, [mode, tripType, checkIn, checkOut]);

    const pickFlex = useCallback((label: string) => () => {
        setFlexOption(label);
        clearTimeout(advanceT.current);
        advanceT.current = setTimeout(() => setPanelOpen('travelers'), 450);
    }, []);

    // ── Search ───────────────────────────────────────────────────────────────

    const handleSearch = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        const needsOrigin = mode === 'flights' && !pickedOrigin;
        if (needsOrigin) {
            setShake(true);
            setPanelOpen('origin');
            clearTimeout(shakeT.current);
            shakeT.current = setTimeout(() => setShake(false), 500);
            return;
        }
        if (!pickedDest) {
            setShake(true);
            setPanelOpen('destination');
            clearTimeout(shakeT.current);
            shakeT.current = setTimeout(() => setShake(false), 500);
            return;
        }

        if (searching) return;
        setPanelOpen(null);
        setIsSearching(true);

        // Straight to the results, with no staged pause first: the button's loading state
        // lasts exactly as long as the results page takes to arrive.
        let href: string;
        if (mode === 'stays') {
            setDestination({ title: pickedDest.name, subtitle: '', type: 'city', countryCode: '', id: pickedDest.id });
            if (checkIn) setDates({ checkIn, checkOut: checkOut ?? undefined });
            setTravelers({ adults, children });
            addRecentSearch({ title: pickedDest.name, subtitle: '', type: 'city', countryCode: '', id: pickedDest.id, lat: pickedDest.lat, lng: pickedDest.lng });
            setSearchMode('hotels');

            const params = new URLSearchParams({
                destination: pickedDest.name,
                checkIn:  checkIn  ? checkIn.toISOString().slice(0, 10)  : '',
                checkOut: checkOut ? checkOut.toISOString().slice(0, 10) : '',
                adults: String(adults), children: String(children), rooms: '1',
            });
            if (pickedDest.lat != null && pickedDest.lng != null) {
                params.set('lat', String(pickedDest.lat));
                params.set('lng', String(pickedDest.lng));
            }
            if (pickedDest.code)                          params.set('destinationCode', pickedDest.code);
            if (pickedDest.rung)                          params.set('rung', pickedDest.rung);
            if (pickedDest.bbox?.length === 4)            params.set('bbox', pickedDest.bbox.join(','));
            if (pickedDest.districtName)                  params.set('districtName', pickedDest.districtName);
            if (pickedDest.canonicalCity)                 params.set('canonicalCity', pickedDest.canonicalCity);
            href = `/search?${params}`;
        } else {
            // flights
            setSearchMode('flights');
            setFlightSegment(0, {
                origin:      pickedOrigin ? { title: pickedOrigin.name, subtitle: '', type: 'city', countryCode: '' } : null,
                destination: { title: pickedDest.name, subtitle: '', type: 'city', countryCode: '', id: pickedDest.id },
                date: checkIn ?? null,
            });

            const params = new URLSearchParams({
                origin:      pickedOrigin?.name ?? '',
                destination: pickedDest.name,
                depart:      checkIn ? checkIn.toISOString().slice(0, 10) : '',
                tripType:    tripType === 'roundtrip' ? 'round-trip' : 'one-way',
                cabin:       'economy',
                adults:      String(adults),
                children:    String(children),
                infants:     '0',
            });
            if (tripType === 'roundtrip' && checkOut) params.set('return', checkOut.toISOString().slice(0, 10));
            href = `/flights/search?${params}`;
        }
        startSearch(() => router.push(href));
    }, [searching, mode, tripType, pickedOrigin, pickedDest, checkIn, checkOut, adults, children, router, setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const originValue = pickedOrigin ? pickedOrigin.name : tAll('search.prose.origin');
    // A flight's destination is never the airport it leaves from.
    const destOrigin = mode === 'flights' ? pickedOrigin?.name : null;
    const destValue   = pickedDest   ? pickedDest.name   : tAll('search.prose.anywhere');

    const isOneway = tripType === 'oneway';

    const datesValue = mode === 'flights'
        ? (isOneway
            ? (checkIn ? fmtDate(checkIn) : tAll('search.prose.aDate'))
            : (checkIn ? (checkOut ? `${fmtDate(checkIn)} → ${fmtDate(checkOut)}` : `${fmtDate(checkIn)} → ?`) : tAll('search.prose.yourDates')))
        : (flexible
            ? (flexOption ?? tAll('search.prose.flexibleTrip'))
            : (checkIn ? (checkOut ? `${fmtDate(checkIn)} → ${fmtDate(checkOut)}` : `${fmtDate(checkIn)} → ?`) : tAll('search.prose.sometime')));

    const totalTravelers = adults + children;
    const travelersValue = totalTravelers === 1 ? tAll('search.prose.justMe') : tAll('search.prose.ofUs', { count: totalTravelers });

    const datesHeading = mode === 'flights'
        ? (isOneway ? tAll('search.whenFlying') : tAll('search.pickDates'))
        : (flexible ? "How long's the trip?" : 'Pick your dates');

    const nights = nightsBetween(checkIn, checkOut);

    const filteredTrending = destQuery.trim()
        ? activeTrending.filter(t => `${t.name}${t.country}`.toLowerCase().includes(destQuery.trim().toLowerCase()))
        : activeTrending;

    // Flights leads with the origin token, so every token after it bounces one beat later.
    const firstToken = mode === 'flights' ? 1 : 0;

    /** The sentence's longest line, which the search pill runs to; 0 until measured. */
    const proseWidth = useProseWidth(proseRef, [mode, originValue, destValue, datesValue, travelersValue]);

    const searchingLabel = mode === 'stays' ? tAll('landing.search.searchingStays') : tAll('landing.search.searchingFlights');

    // Each connective's leading comma rides in the slot before it, so it never starts a line.
    const [datesMark, datesLead] = leadingMark(mode === 'flights' ? tAll('search.prose.onDates') : tAll('search.prose.fromDates'));
    const [travelersMark, travelersLead] = leadingMark(tAll('search.prose.withTravelers'));

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
                @keyframes immSbSpin   { to { transform: rotate(360deg); } }
                @keyframes immSbShake  { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)} }
                @keyframes immSbPulse  { 0%,100%{box-shadow:0 16px 30px -10px rgba(37,99,235,.55),0 0 0 0 rgba(96,165,250,.45)} 50%{box-shadow:0 16px 30px -10px rgba(37,99,235,.55),0 0 0 10px rgba(96,165,250,0)} }
                @keyframes immSbHint   { 0%,100%{opacity:.92} 50%{opacity:.45} }
                @keyframes immSbBounce { 0%,40%,100%{transform:translateY(0)} 12%{transform:translateY(-7px)} 24%{transform:translateY(0)} 32%{transform:translateY(-3px)} }
                @keyframes immSbSheen  { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
                .imm-ribbon::-webkit-scrollbar { height:4px }
                .imm-ribbon::-webkit-scrollbar-thumb { background:rgba(255,255,255,.18);border-radius:2px }
                .imm-token-caret  { animation:immSbBounce 2.4s ease-in-out infinite }
                .imm-token:hover  { opacity:.85 }
                .imm-token:hover .imm-token-caret { animation:none; transform:translateY(2px) }
                @media (prefers-reduced-motion:reduce) { .imm-token-caret { animation:none } }
                .imm-stamp:not([aria-busy="true"]):hover { filter:brightness(0.88) }
                .imm-stamp[aria-busy="true"]::after {
                  content:''; position:absolute; inset:0; pointer-events:none;
                  background:linear-gradient(100deg,transparent 25%,rgba(255,255,255,.28) 50%,transparent 75%);
                  animation:immSbSheen 1.3s ease-in-out infinite;
                }
                @media (prefers-reduced-motion:reduce) { .imm-stamp[aria-busy="true"]::after { animation:none; opacity:0 } }
                .imm-dest-card:hover { opacity:.85 }
                .imm-row:hover    { background:rgba(255,255,255,.07);border-radius:14px }
                /* Below 760px a panel is a bottom sheet (NotePanel); it rises rather than appears. */
                @keyframes immSbSheetIn { from{transform:translateY(100%)} to{transform:none} }
                @keyframes immSbFadeIn  { from{opacity:0} to{opacity:1} }
                .imm-sheet          { animation:immSbSheetIn .28s cubic-bezier(.2,.8,.2,1) }
                .imm-sheet-backdrop { animation:immSbFadeIn .2s ease }
                @media (prefers-reduced-motion:reduce) { .imm-sheet, .imm-sheet-backdrop { animation:none } }
                /* A phone. The sentence lines up with the stage heading above it (the panel's
                   own gutter is enough), sits closer together, and its pieces shrink with it.
                   Read by the inline styles below and in prose-parts through their fallbacks. */
                @media (max-width:640px) {
                  .imm-bar {
                    --imm-pad:0px; --imm-gap:14px; --imm-min-h:0px;
                    --imm-tab-pad:9px 18px; --imm-tab-size:13px;
                    --imm-caret:1.2rem; --imm-go-h:50px;
                  }
                }
            `}</style>

            <div ref={wrapRef} className="imm-bar" style={{ width: '100%', maxWidth: '900px', position: 'relative', margin: '0 auto' }}>

                {/* ── Container ─────────────────────────────────────────── */}
                {/* Transparent: the prose sits straight on the page canvas, with no
                    surface, wash or border of its own. */}
                <div style={{
                    // Only enough floor to stop the block jumping as the headline
                    // rewraps between modes — with the card gone there is nothing
                    // left to fill, and a taller box just pushed the prose down.
                    position: 'relative', width: '100%',
                    minHeight: 'var(--imm-min-h,clamp(220px,26vw,320px))',
                    color: '#fff',
                }}>
                    {/* Content */}
                    <div style={{ position: 'relative', minHeight: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--imm-pad,clamp(28px,4.5vw,48px))', gap: 'var(--imm-gap,18px)', boxSizing: 'border-box' }}>

                        {/* ── Mode tabs ── */}
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(2,6,23,.35)', border: `1px solid ${BRAND.glassBorder}`, backdropFilter: 'blur(24px)', borderRadius: '100px', padding: '4px', gap: '2px' }}>
                            {(['stays', 'flights', 'golf'] as Mode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={handleSetMode(m)}
                                    style={{
                                        padding: 'var(--imm-tab-pad,7px 16px)', borderRadius: '100px', border: 'none',
                                        fontSize: 'var(--imm-tab-size,12px)', fontWeight: 700, letterSpacing: '.04em',
                                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                        background: mode === m ? BRAND.gradient : 'transparent',
                                        color:      mode === m ? '#fff' : 'rgba(255,255,255,.85)',
                                        boxShadow:  mode === m ? '0 6px 18px -6px rgba(37,99,235,.65)' : 'none',
                                        transition: 'color .2s,box-shadow .2s',
                                        textTransform: 'capitalize',
                                    }}
                                >{tAll(`landing.search.searchMode.${m}`)}</button>
                            ))}
                        </div>

                        {/* Golf's sentence is its own component (it has its own tokens and its own
                            GO); the tabs above stay the bar's, so the three read as one control. */}
                        {mode === 'golf' ? (
                            <GolfSentence courses={golfCourses} coursePick={coursePick} onCourseChange={onCourseChange} />
                        ) : (<>

                        {/* ── Prose headline ── */}
                        <div ref={proseRef} style={PROSE}>

                            {/* FLIGHTS MODE */}
                            {mode === 'flights' && (
                                <>
                                    {tAll('search.prose.flyFrom')}
                                    {/* Origin token */}
                                    <Slot>
                                        <Token filled={!!pickedOrigin} hint={hint} order={0} onClick={openPanel('origin')}>
                                            {originValue}
                                        </Token>
                                        {panelOpen === 'origin' && (
                                            <NotePanel>
                                                <DestPanel
                                                    query={originQuery}
                                                    onQueryChange={setOriginQuery}
                                                    suggestions={originSugs}
                                                    sugLoading={originSugLoading}
                                                    onPickSuggestion={pickOriginSuggestion}
                                                    airports={POPULAR_AIRPORTS}
                                                    noMatchLabel={tAll('search.noAirportsMatch', { query: originQuery.trim() })}
                                                    placeholder={tAll('search.cityAirportPlaceholder')}
                                                    trendingLabel={tAll('search.popularAirports')}
                                                />
                                            </NotePanel>
                                        )}
                                    </Slot>
                                    {tAll('search.prose.to')}
                                </>
                            )}

                            {/* STAYS MODE */}
                            {mode === 'stays' && tAll('search.prose.stayIn')}

                            {' '}

                            {/* Destination token */}
                            <Slot>
                                <Token filled={!!pickedDest} hint={hint} order={firstToken} onClick={openPanel('destination')}>
                                    {destValue}
                                </Token>
                                {datesMark}
                                {panelOpen === 'destination' && (
                                    <NotePanel>
                                        <DestPanel
                                            query={destQuery}
                                            onQueryChange={setDestQuery}
                                            suggestions={excludeOrigin(destSugs, destOrigin).slice(0, 6)}
                                            sugLoading={destSugLoading}
                                            onPickSuggestion={pickDestSuggestion}
                                            {...(mode === 'flights'
                                                // Airports, not the stays cards: a flight is booked to one.
                                                ? {
                                                    airports:      excludeOrigin(POPULAR_AIRPORTS, destOrigin),
                                                    noMatchLabel:  tAll('search.noAirportsMatch', { query: destQuery.trim() }),
                                                    placeholder:   tAll('search.cityAirportPlaceholder'),
                                                    trendingLabel: tAll('search.popularAirports'),
                                                }
                                                : {
                                                    trending:           filteredTrending,
                                                    onPickTrending:     pickDestTrending,
                                                    recentDestinations: recentSearches,
                                                    onPickRecent:       pickDestRecent,
                                                })}
                                        />
                                    </NotePanel>
                                )}
                            </Slot>

                            {datesLead}

                            {/* Dates token */}
                            <Slot>
                                <Token filled={!!checkIn || !!flexOption} hint={hint} order={firstToken + 1} onClick={openPanel('dates')}>
                                    {datesValue}
                                </Token>
                                {travelersMark}
                                {panelOpen === 'dates' && (
                                    <NotePanel width="min(400px,92vw)" extra={{ textAlign: 'left', maxHeight: 'none' }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: 700, fontSize: '16px', fontFamily: 'var(--font-sans)' }}>{datesHeading}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {checkIn && (
                                                    <button
                                                        style={{ border: 'none', ...GRADIENT_TEXT, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                                                        onClick={e => { e.stopPropagation(); setCheckIn(null); setCheckOut(null); setFlexOption(null); }}
                                                    >{tAll('search.clear')}</button>
                                                )}
                                                {/* Stays: flexible toggle */}
                                                {mode === 'stays' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setFlexible(f => !f); setCheckIn(null); setCheckOut(null); setFlexOption(null); }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(241,245,249,0.6)' }}>{tAll('search.imFlexible')}</span>
                                                        <div style={{ width: '38px', height: '22px', borderRadius: '11px', background: flexible ? FILL : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background .25s', flexShrink: 0 }}>
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: flexible ? '18px' : '2px', transition: 'left .25s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Flights: one-way / round-trip */}
                                                {mode === 'flights' && (
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {(['oneway', 'roundtrip'] as TripType[]).map(tt => {
                                                            const active = tripType === tt;
                                                            const label = tt === 'oneway' ? tAll('search.oneWay') : tAll('search.roundTrip');
                                                            return (
                                                                <button
                                                                    key={tt}
                                                                    onClick={e => { e.stopPropagation(); setTripType(tt); setCheckIn(null); setCheckOut(null); }}
                                                                    style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: active ? '1.5px solid transparent' : '1.5px solid rgba(255,255,255,0.18)', background: active ? FILL : 'transparent', boxShadow: active ? BRAND.gradientShadow : 'none', color: active ? '#fff' : '#f1f5f9', transition: 'all .2s' }}
                                                                >{label}</button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Month-grid calendar (exact mode) */}
                                        {(!flexible) && (
                                            <CalendarGrid
                                                checkIn={checkIn}
                                                checkOut={checkOut}
                                                onSelect={d => selectDay(d)()}
                                                accent={FILL}
                                            />
                                        )}

                                        {/* Nights counter */}
                                        {!flexible && nights && (
                                            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: 'rgba(241,245,249,0.6)', textAlign: 'center' }}>
                                                {tAll('search.nights', { count: nights })}
                                            </div>
                                        )}

                                        {/* Flexible chips (stays only) */}
                                        {mode === 'stays' && flexible && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                {FLEX_CHIPS.map(label => {
                                                    const active = flexOption === label;
                                                    return (
                                                        <button
                                                            key={label}
                                                            style={{ padding: '10px 16px', borderRadius: '14px', border: active ? '1.5px solid transparent' : '1.5px solid rgba(255,255,255,0.18)', background: active ? FILL : 'transparent', boxShadow: active ? BRAND.gradientShadow : 'none', color: active ? '#fff' : '#f1f5f9', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity .2s' }}
                                                            onClick={e => { e.stopPropagation(); pickFlex(label)(); }}
                                                        >{label}</button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </NotePanel>
                                )}
                            </Slot>

                            {travelersLead}

                            {/* Travelers token */}
                            <Slot>
                                <Token filled onClick={openPanel('travelers')} hint={false} order={firstToken + 2}>
                                    {travelersValue}
                                </Token>
                                {'.'}
                                {panelOpen === 'travelers' && (
                                    <NotePanel width="280px" extra={{ maxHeight: 'none' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)', marginBottom: '18px' }}>
                                            {mode === 'flights' ? tAll('checkout.flight.whosFlying') : tAll('landing.search.whosComing')}
                                        </div>
                                        {[
                                            { label: tAll('landing.search.adults'),   sub: '18+',      val: adults,   set: setAdults,   min: 1,  max: 16 },
                                            { label: tAll('landing.search.children'), sub: '0–17',     val: children, set: setChildren, min: 0,  max: 8  },
                                        ].map(({ label, sub, val, set, min, max }) => (
                                            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9' }}>{label}</div>
                                                    <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.45)' }}>{sub}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <button onClick={e => { e.stopPropagation(); set((n: number) => Math.max(min, n - 1)); }} disabled={val <= min} style={{ width: 'var(--imm-step,36px)', height: 'var(--imm-step,36px)', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow, fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val <= min ? 'not-allowed' : 'pointer', opacity: val <= min ? 0.3 : 1 }}>−</button>
                                                    <div style={{ fontSize: '18px', fontWeight: 800, minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#f1f5f9' }}>{val}</div>
                                                    <button onClick={e => { e.stopPropagation(); set((n: number) => Math.min(max, n + 1)); }} disabled={val >= max} style={{ width: 'var(--imm-step,36px)', height: 'var(--imm-step,36px)', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow, fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val >= max ? 'not-allowed' : 'pointer', opacity: val >= max ? 0.3 : 1 }}>+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </NotePanel>
                                )}
                            </Slot>
                        </div>

                        {/* ── Search pill ───────────────────────────────── */}
                        {/* `handleSearch` ignores a second press while searching. */}
                        <GoPill
                            onClick={handleSearch}
                            searching={searching}
                            shake={shake}
                            width={proseWidth}
                            label={tAll('landing.search.go')}
                            searchingLabel={searchingLabel}
                        />
                        </>)}
                    </div>
                </div>
            </div>
        </>
    );
}
