'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchStore } from '@/shared/stores/search.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'stays' | 'flights';
type TripType = 'oneway' | 'roundtrip';
type PanelType = 'origin' | 'destination' | 'dates' | 'travelers' | null;
type CtaState = 'idle' | 'searching' | 'done';

interface DestSuggestion {
    type: 'city' | 'country';
    title: string;
    subtitle: string;
    countryCode: string;
    id?: string;
}

interface TrendingDest {
    id: string;
    name: string;
    country: string;
    tag: string;
    mood: string;
    bgClass: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRENDING: TrendingDest[] = [
    { id: 'bali',      name: 'Bali',      country: 'Indonesia', tag: 'Island escape',  mood: 'rgba(45,190,175,0.35)', bgClass: 'bg-gradient-to-br from-teal-500 to-emerald-700' },
    { id: 'santorini', name: 'Santorini', country: 'Greece',    tag: 'Coastal cliffs', mood: 'rgba(70,140,225,0.32)', bgClass: 'bg-gradient-to-br from-blue-400 to-sky-700' },
    { id: 'kyoto',     name: 'Kyoto',     country: 'Japan',     tag: 'Culture & calm', mood: 'rgba(225,110,165,0.30)', bgClass: 'bg-gradient-to-br from-pink-400 to-rose-700' },
    { id: 'marrakech', name: 'Marrakech', country: 'Morocco',   tag: 'Desert warmth',  mood: 'rgba(240,145,60,0.35)',  bgClass: 'bg-gradient-to-br from-amber-400 to-orange-700' },
];

const BACKDROP_BY_ID: Record<string, string> = {
    bali:      'linear-gradient(160deg,#0d3d2e 0%,#1a5c40 45%,#0d2e1c 100%)',
    santorini: 'linear-gradient(160deg,#0d2b4a 0%,#1a4a7a 45%,#0d1f38 100%)',
    kyoto:     'linear-gradient(160deg,#3d0d2b 0%,#6b1a4a 45%,#2e0d1c 100%)',
    marrakech: 'linear-gradient(160deg,#3d2000 0%,#6b3800 45%,#2e1800 100%)',
};

const FLEX_CHIPS = ['Weekend getaway', 'One week', 'Two weeks', 'Flexible / anytime'];

const ACCENT = '#FF6B4B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
}

function buildDays(count = 60): Date[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });
}

// ─── Shared SVGs ─────────────────────────────────────────────────────────────

function CaretIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

function SearchMiniIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.2-3.2" />
        </svg>
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

// ─── Token ────────────────────────────────────────────────────────────────────

interface TokenProps {
    filled: boolean;
    hint: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
}

function Token({ filled, hint, onClick, children }: TokenProps) {
    return (
        <span
            onClick={onClick}
            className="imm-token cursor-pointer font-bold pb-0.5 inline-flex items-baseline gap-0.5 transition-opacity duration-300"
            style={{
                borderBottomWidth: '3px',
                borderBottomStyle: filled ? 'solid' : 'dashed',
                borderBottomColor: ACCENT,
                opacity: filled ? 1 : 0.92,
                animation: (!filled && hint) ? 'immSbHint 1.6s ease-in-out infinite' : 'none',
            }}
        >
            {children}
            <span style={{ color: ACCENT, display: 'inline-flex', verticalAlign: 'middle', marginLeft: '1px', opacity: 0.85 }}>
                <CaretIcon />
            </span>
        </span>
    );
}

// ─── Sticky-note panel ────────────────────────────────────────────────────────

function NotePanel({ children, width = 'min(360px,88vw)', extra = {} }: {
    children: React.ReactNode;
    width?: string;
    extra?: React.CSSProperties;
}) {
    return (
        <div style={{
            position: 'absolute',
            top: 'calc(100% + 18px)',
            left: '50%',
            transform: 'translateX(-50%) rotate(-0.6deg)',
            width,
            background: 'rgba(18,14,28,0.97)',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 26px 55px -18px rgba(0,0,0,0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            zIndex: 40,
            maxHeight: '380px',
            overflowY: 'auto',
            fontFamily: 'var(--font-jakarta, sans-serif)',
            fontSize: '15px',
            lineHeight: '1.4',
            color: '#F5EFE4',
            ...extra,
        }}>
            {/* Paper-fold tab */}
            <div style={{
                position: 'absolute', top: '-10px', left: '28px',
                width: '56px', height: '16px', background: 'rgba(255,183,94,0.65)',
                borderRadius: '3px', transform: 'rotate(-5deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }} />
            {children}
        </div>
    );
}

// ─── Destination search panel (shared between origin + dest) ─────────────────

interface DestPanelProps {
    query: string;
    onQueryChange: (v: string) => void;
    suggestions: DestSuggestion[];
    sugLoading: boolean;
    onPickSuggestion: (s: DestSuggestion) => void;
    trending: TrendingDest[];
    onPickTrending: (t: TrendingDest) => void;
    recentTitles?: string[];
    onPickRecent?: (title: string) => void;
    placeholder?: string;
    trendingLabel?: string;
}

function DestPanel({
    query, onQueryChange, suggestions, sugLoading,
    onPickSuggestion, trending, onPickTrending,
    recentTitles = [], onPickRecent,
    placeholder = 'Search cities, countries, anywhere…',
    trendingLabel = 'Trending right now',
}: DestPanelProps) {
    const showSuggestions = query.trim().length >= 2 && suggestions.length > 0;
    const showRecent = !query.trim() && recentTitles.length > 0 && onPickRecent;
    const showTrending = trending.length > 0;
    return (
        <>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1.5px solid rgba(255,255,255,0.14)', paddingBottom: '10px', marginBottom: '18px' }}>
                <span style={{ display: 'flex', color: 'rgba(245,239,228,0.42)', flexShrink: 0 }}><SearchMiniIcon /></span>
                <input
                    type="text"
                    value={query}
                    onChange={e => onQueryChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', flex: 1, color: '#F5EFE4', fontFamily: 'var(--font-jakarta, sans-serif)' }}
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
                    {suggestions.map((s, i) => (
                        <div key={i} className="imm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer' }} onClick={() => onPickSuggestion(s)}>
                            <span style={{ display: 'flex', color: 'rgba(245,239,228,0.42)', flexShrink: 0 }}><SearchMiniIcon /></span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                                <div style={{ fontSize: '12px', color: 'rgba(245,239,228,0.6)', marginTop: '1px' }}>{s.subtitle}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent searches */}
            {showRecent && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(245,239,228,0.42)', marginBottom: '10px' }}>
                        Pick up where you left off
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
                        {recentTitles.slice(0, 3).map((title, i) => (
                            <div key={i} className="imm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer' }} onClick={() => onPickRecent!(title)}>
                                <span style={{ display: 'flex', color: 'rgba(245,239,228,0.42)', flexShrink: 0 }}><ClockMiniIcon /></span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Trending */}
            {showTrending && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(245,239,228,0.42)', marginBottom: '10px' }}>
                        {trendingLabel}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                        {trending.map(dest => (
                            <div key={dest.id} className="imm-dest-card" style={{ flex: '1 1 120px', cursor: 'pointer', transition: 'opacity .2s' }} onClick={() => onPickTrending(dest)}>
                                <div className={dest.bgClass} style={{ width: '100%', height: '80px', marginBottom: '8px', borderRadius: '14px' }} />
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>{dest.name}</div>
                                <div style={{ fontSize: '12px', color: 'rgba(245,239,228,0.6)' }}>{dest.country} · {dest.tag}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImmersiveSearchBar() {
    const router = useRouter();
    const { recentSearches, setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment } = useSearchStore();

    // Mode
    const [mode, setMode] = useState<Mode>('stays');
    const [tripType, setTripType] = useState<TripType>('oneway');

    // Panel
    const [panelOpen, setPanelOpen] = useState<PanelType>(null);

    // Origin (flights only)
    const [originQuery, setOriginQuery] = useState('');
    const [originSugs, setOriginSugs] = useState<DestSuggestion[]>([]);
    const [originSugLoading, setOriginSugLoading] = useState(false);
    const [pickedOrigin, setPickedOrigin] = useState<{ name: string; mood: string; trendingId?: string } | null>(null);

    // Destination
    const [destQuery, setDestQuery] = useState('');
    const [destSugs, setDestSugs] = useState<DestSuggestion[]>([]);
    const [destSugLoading, setDestSugLoading] = useState(false);
    const [pickedDest, setPickedDest] = useState<{ name: string; mood: string; trendingId?: string; id?: string } | null>(null);

    // Dates
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [flexible, setFlexible] = useState(false);
    const [flexOption, setFlexOption] = useState<string | null>(null);

    // Travelers
    const [travelers, setTravelersCount] = useState(2);

    // UX
    const [ctaState, setCtaState] = useState<CtaState>('idle');
    const [resultsCount, setResultsCount] = useState<number | null>(null);
    const [shake, setShake] = useState(false);
    const [hint, setHint] = useState(true);

    // Refs
    const wrapRef  = useRef<HTMLDivElement>(null);
    const ribbonRef = useRef<HTMLDivElement>(null);
    const shakeT   = useRef<ReturnType<typeof setTimeout>>();
    const ctaT1    = useRef<ReturnType<typeof setTimeout>>();
    const ctaT2    = useRef<ReturnType<typeof setTimeout>>();
    const advanceT = useRef<ReturnType<typeof setTimeout>>();
    const hintT    = useRef<ReturnType<typeof setTimeout>>();
    const origSugT = useRef<ReturnType<typeof setTimeout>>();
    const destSugT = useRef<ReturnType<typeof setTimeout>>();

    const days = useRef<Date[]>(buildDays(60));

    // ── Lifecycle ────────────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setPanelOpen(null);
            }
        };
        document.addEventListener('mousedown', handler);
        hintT.current = setTimeout(() => setHint(false), 6000);
        return () => {
            document.removeEventListener('mousedown', handler);
            [hintT, shakeT, ctaT1, ctaT2, advanceT, origSugT, destSugT].forEach(r => clearTimeout(r.current));
        };
    }, []);

    // ── Autocomplete ─────────────────────────────────────────────────────────

    useEffect(() => {
        clearTimeout(origSugT.current);
        const q = originQuery.trim();
        if (q.length < 2) { setOriginSugs([]); return; }
        setOriginSugLoading(true);
        origSugT.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?query=${encodeURIComponent(q)}`);
                const json = await res.json();
                setOriginSugs(json.success ? json.data.slice(0, 6) : []);
            } catch { setOriginSugs([]); }
            finally { setOriginSugLoading(false); }
        }, 280);
    }, [originQuery]);

    useEffect(() => {
        clearTimeout(destSugT.current);
        const q = destQuery.trim();
        if (q.length < 2) { setDestSugs([]); return; }
        setDestSugLoading(true);
        destSugT.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?query=${encodeURIComponent(q)}`);
                const json = await res.json();
                setDestSugs(json.success ? json.data.slice(0, 6) : []);
            } catch { setDestSugs([]); }
            finally { setDestSugLoading(false); }
        }, 280);
    }, [destQuery]);

    // ── Mode switch ──────────────────────────────────────────────────────────

    const handleSetMode = useCallback((m: Mode) => (e: React.MouseEvent) => {
        e.stopPropagation();
        clearTimeout(advanceT.current);
        setMode(m);
        setPanelOpen(null);
        setCheckIn(null);
        setCheckOut(null);
        setFlexOption(null);
        setFlexible(false);
    }, []);

    // ── Panel toggle ─────────────────────────────────────────────────────────

    const openPanel = useCallback((name: PanelType) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setPanelOpen(p => p === name ? null : name);
        setHint(false);
    }, []);

    // ── Origin picks ─────────────────────────────────────────────────────────

    const pickOriginTrending = useCallback((t: TrendingDest) => {
        clearTimeout(advanceT.current);
        setPickedOrigin({ name: t.name, mood: t.mood, trendingId: t.id });
        setOriginQuery('');
        setOriginSugs([]);
        setPanelOpen('destination');
    }, []);

    const pickOriginSuggestion = useCallback((s: DestSuggestion) => {
        clearTimeout(advanceT.current);
        setPickedOrigin({ name: s.title, mood: 'rgba(255,255,255,0.15)' });
        setOriginQuery('');
        setOriginSugs([]);
        setPanelOpen('destination');
    }, []);

    // ── Destination picks ────────────────────────────────────────────────────

    const pickDestTrending = useCallback((t: TrendingDest) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: t.name, mood: t.mood, trendingId: t.id });
        setDestQuery('');
        setDestSugs([]);
        setPanelOpen('dates');
    }, []);

    const pickDestSuggestion = useCallback((s: DestSuggestion) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: s.title, mood: 'rgba(255,255,255,0.15)', id: s.id });
        setDestQuery('');
        setDestSugs([]);
        setPanelOpen('dates');
    }, []);

    const pickDestRecent = useCallback((title: string) => {
        clearTimeout(advanceT.current);
        setPickedDest({ name: title, mood: 'rgba(255,255,255,0.15)' });
        setDestQuery('');
        setPanelOpen('dates');
    }, []);

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

        setCtaState('searching');
        setPanelOpen(null);

        clearTimeout(ctaT1.current);
        ctaT1.current = setTimeout(() => {
            const count = 1180 + Math.floor(Math.random() * 3600);
            setResultsCount(count);
            setCtaState('done');
            setIsSearching(true);

            if (mode === 'stays') {
                setDestination({ title: pickedDest.name, subtitle: '', type: 'city', countryCode: '', id: pickedDest.id });
                if (checkIn) setDates({ checkIn, checkOut: checkOut ?? undefined });
                setTravelers({ adults: travelers });
                addRecentSearch({ title: pickedDest.name, subtitle: '', type: 'city', countryCode: '', id: pickedDest.id });
                setSearchMode('hotels');

                const params = new URLSearchParams({
                    destination: pickedDest.name, code: '', type: 'city', lat: '', lng: '',
                    checkIn:  checkIn  ? checkIn.toISOString().slice(0, 10)  : '',
                    checkOut: checkOut ? checkOut.toISOString().slice(0, 10) : '',
                    adults: String(travelers), children: '0', rooms: '1',
                });
                clearTimeout(ctaT2.current);
                ctaT2.current = setTimeout(() => router.push(`/search?${params}`), 800);
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
                    adults:      String(travelers),
                    children:    '0',
                    infants:     '0',
                });
                if (tripType === 'roundtrip' && checkOut) params.set('return', checkOut.toISOString().slice(0, 10));
                clearTimeout(ctaT2.current);
                ctaT2.current = setTimeout(() => router.push(`/flights/search?${params}`), 800);
            }
        }, 1200);
    }, [mode, tripType, pickedOrigin, pickedDest, checkIn, checkOut, travelers, router, setDestination, setDates, setTravelers, setIsSearching, addRecentSearch, setSearchMode, setFlightSegment]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const backdropKey = pickedDest?.trendingId ?? pickedOrigin?.trendingId;
    const backdrop = backdropKey
        ? (BACKDROP_BY_ID[backdropKey] ?? 'linear-gradient(160deg,#1a0533 0%,#2d1b4e 45%,#1c1030 100%)')
        : 'linear-gradient(160deg,#1a0533 0%,#2d1b4e 45%,#1c1030 100%)';
    const moodColor = pickedDest?.mood ?? pickedOrigin?.mood ?? 'rgba(255,255,255,0)';

    const originValue = pickedOrigin ? pickedOrigin.name : 'wherever you are';
    const destValue   = pickedDest   ? pickedDest.name   : 'somewhere amazing';

    const isOneway = tripType === 'oneway';

    const datesValue = mode === 'flights'
        ? (isOneway
            ? (checkIn ? fmtDate(checkIn) : 'a date')
            : (checkIn ? (checkOut ? `${fmtDate(checkIn)} → ${fmtDate(checkOut)}` : `${fmtDate(checkIn)} → ?`) : 'your dates'))
        : (flexible
            ? (flexOption ?? 'a flexible trip')
            : (checkIn ? (checkOut ? `${fmtDate(checkIn)} → ${fmtDate(checkOut)}` : `${fmtDate(checkIn)} → ?`) : 'sometime soon'));

    const travelersValue = travelers === 1 ? 'just me' : `${travelers} of us`;
    const resultsLabel   = mode === 'stays' ? 'stays' : 'flights';

    const eyebrow = mode === 'flights'
        ? ((pickedOrigin && pickedDest) ? 'FLIGHT LOCKED IN' : 'PLAN YOUR FLIGHT')
        : (pickedDest ? 'DESTINATION LOCKED IN' : 'PLAN YOUR NEXT TRIP');

    const datesHeading = mode === 'flights'
        ? (isOneway ? 'When are you flying?' : 'Pick your dates')
        : (flexible ? "How long's the trip?" : 'Pick your dates');

    const startIdx = checkIn  ? days.current.findIndex(d => sameDay(d, checkIn))  : -1;
    const endIdx   = checkOut ? days.current.findIndex(d => sameDay(d, checkOut)) : -1;
    const hasRange = startIdx > -1 && endIdx > -1;
    const nights   = hasRange ? Math.round((checkOut!.getTime() - checkIn!.getTime()) / 86400000) : null;

    const filteredTrending = destQuery.trim()
        ? TRENDING.filter(t => `${t.name}${t.country}`.toLowerCase().includes(destQuery.trim().toLowerCase()))
        : TRENDING;

    const stampBg = ctaState === 'done' ? '#2FB67F' : ACCENT;
    const stampTransform = ctaState === 'done' ? 'rotate(0deg) scale(1.05)' : 'rotate(-8deg)';
    const stampAnimation = shake
        ? 'immSbShake 420ms ease'
        : ctaState === 'searching'
            ? 'immSbSpin 1s linear infinite'
            : ctaState === 'idle'
                ? 'immSbPulse 2.6s ease-in-out infinite'
                : 'none';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
                @keyframes immSbSpin   { to { transform: rotate(360deg); } }
                @keyframes immSbShake  { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)} }
                @keyframes immSbPulse  { 0%,100%{box-shadow:0 16px 30px -10px rgba(20,10,35,.55),0 0 0 0 rgba(255,255,255,.5)} 50%{box-shadow:0 16px 30px -10px rgba(20,10,35,.55),0 0 0 10px rgba(255,255,255,0)} }
                @keyframes immSbHint   { 0%,100%{opacity:.92} 50%{opacity:.45} }
                .imm-ribbon::-webkit-scrollbar { height:4px }
                .imm-ribbon::-webkit-scrollbar-thumb { background:rgba(255,255,255,.18);border-radius:2px }
                .imm-token:hover  { opacity:.75 }
                .imm-stamp:hover  { filter:brightness(0.88) }
                .imm-dest-card:hover { opacity:.85 }
                .imm-row:hover    { background:rgba(255,255,255,.07);border-radius:14px }
            `}</style>

            <div ref={wrapRef} style={{ width: '100%', maxWidth: '900px', position: 'relative', margin: '0 auto' }}>

                {/* ── Backdrop card ─────────────────────────────────────── */}
                <div style={{
                    position: 'relative', width: '100%',
                    height: 'clamp(280px,42vw,480px)',
                    boxShadow: '0 30px 70px -25px rgba(20,10,35,.5)',
                    borderRadius: '32px', color: '#fff',
                    overflow: 'hidden',
                    background: backdrop,
                    transition: 'background 1s ease',
                }}>
                    {/* Mood wash */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '32px', background: moodColor, mixBlendMode: 'overlay', transition: 'background .8s ease', pointerEvents: 'none' }} />

                    {/* Dark vignette */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '32px', background: 'linear-gradient(165deg,rgba(20,12,30,.15) 0%,rgba(15,8,20,.15) 45%,rgba(10,6,16,.68) 100%)', pointerEvents: 'none' }} />

                    {/* Content */}
                    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(28px,4.5vw,48px)', gap: '18px', boxSizing: 'border-box' }}>

                        {/* ── Mode tabs ── */}
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.32)', backdropFilter: 'blur(8px)', borderRadius: '100px', padding: '4px', gap: '2px' }}>
                            {(['stays', 'flights'] as Mode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={handleSetMode(m)}
                                    style={{
                                        padding: '7px 16px', borderRadius: '100px', border: 'none',
                                        fontSize: '12px', fontWeight: 700, letterSpacing: '.04em',
                                        cursor: 'pointer', fontFamily: 'var(--font-jakarta, sans-serif)',
                                        background: mode === m ? '#fff' : 'transparent',
                                        color:      mode === m ? '#241f2e' : 'rgba(255,255,255,.85)',
                                        transition: 'background .2s,color .2s',
                                        textTransform: 'capitalize',
                                    }}
                                >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
                            ))}
                        </div>

                        {/* ── Eyebrow badge ── */}
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.32)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: '100px', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                            {eyebrow}
                        </div>

                        {/* ── Prose headline ── */}
                        <div style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 600, fontSize: 'clamp(23px,3.4vw,42px)', lineHeight: 1.42, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.35)', maxWidth: '680px' }}>

                            {/* FLIGHTS MODE */}
                            {mode === 'flights' && (
                                <>
                                    {'Fly me from '}
                                    {/* Origin token */}
                                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                        <Token filled={!!pickedOrigin} hint={hint} onClick={openPanel('origin')}>
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
                                                    trending={TRENDING}
                                                    onPickTrending={pickOriginTrending}
                                                    placeholder="Search cities, airports…"
                                                    trendingLabel="Popular cities"
                                                />
                                            </NotePanel>
                                        )}
                                    </span>
                                    {' to'}
                                </>
                            )}

                            {/* STAYS MODE */}
                            {mode === 'stays' && 'Find me a stay in'}

                            {' '}

                            {/* Destination token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled={!!pickedDest} hint={hint} onClick={openPanel('destination')}>
                                    {destValue}
                                </Token>
                                {panelOpen === 'destination' && (
                                    <NotePanel>
                                        <DestPanel
                                            query={destQuery}
                                            onQueryChange={setDestQuery}
                                            suggestions={destSugs}
                                            sugLoading={destSugLoading}
                                            onPickSuggestion={pickDestSuggestion}
                                            trending={filteredTrending}
                                            onPickTrending={pickDestTrending}
                                            recentTitles={recentSearches.map(r => r.title)}
                                            onPickRecent={pickDestRecent}
                                        />
                                    </NotePanel>
                                )}
                            </span>

                            {mode === 'flights' ? ', on ' : ', from '}

                            {/* Dates token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled={!!checkIn || !!flexOption} hint={hint} onClick={openPanel('dates')}>
                                    {datesValue}
                                </Token>
                                {panelOpen === 'dates' && (
                                    <NotePanel width="min(400px,92vw)" extra={{ textAlign: 'left', maxHeight: 'none' }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: 700, fontSize: '16px', fontFamily: 'var(--font-fredoka, sans-serif)' }}>{datesHeading}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {checkIn && (
                                                    <button
                                                        style={{ border: 'none', background: 'transparent', color: ACCENT, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-jakarta, sans-serif)' }}
                                                        onClick={e => { e.stopPropagation(); setCheckIn(null); setCheckOut(null); setFlexOption(null); }}
                                                    >Clear</button>
                                                )}
                                                {/* Stays: flexible toggle */}
                                                {mode === 'stays' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setFlexible(f => !f); setCheckIn(null); setCheckOut(null); setFlexOption(null); }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(245,239,228,0.6)' }}>I&apos;m flexible</span>
                                                        <div style={{ width: '38px', height: '22px', borderRadius: '11px', background: flexible ? ACCENT : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background .25s', flexShrink: 0 }}>
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: flexible ? '18px' : '2px', transition: 'left .25s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Flights: one-way / round-trip */}
                                                {mode === 'flights' && (
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {(['oneway', 'roundtrip'] as TripType[]).map(tt => {
                                                            const active = tripType === tt;
                                                            const label = tt === 'oneway' ? 'One-way' : 'Round-trip';
                                                            return (
                                                                <button
                                                                    key={tt}
                                                                    onClick={e => { e.stopPropagation(); setTripType(tt); setCheckIn(null); setCheckOut(null); }}
                                                                    style={{ padding: '7px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-jakarta, sans-serif)', border: active ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.18)', background: active ? ACCENT : 'transparent', color: active ? '#fff' : '#F5EFE4', transition: 'all .2s' }}
                                                                >{label}</button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Date ribbon (exact mode) */}
                                        {(!flexible) && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <button onClick={e => { e.stopPropagation(); ribbonRef.current?.scrollBy({ left: -220, behavior: 'smooth' }); }} style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#F5EFE4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                                                </button>

                                                <div
                                                    ref={ribbonRef}
                                                    className="imm-ribbon"
                                                    style={{ flex: 1, display: 'flex', overflowX: 'auto', position: 'relative', padding: '16px 2px 8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.18) transparent' }}
                                                    onWheel={e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) ribbonRef.current!.scrollLeft += e.deltaY; }}
                                                >
                                                    {hasRange && (
                                                        <div style={{ position: 'absolute', top: '18px', left: `${startIdx * 50 + 7}px`, width: `${(endIdx - startIdx) * 50 + 36}px`, height: '36px', borderRadius: '18px', background: 'rgba(255,255,255,0.10)', zIndex: 0, pointerEvents: 'none' }} />
                                                    )}
                                                    {days.current.map((d, i) => {
                                                        const isEdge = i === startIdx || i === endIdx;
                                                        const inRange = hasRange && i > startIdx && i < endIdx;
                                                        return (
                                                            <div key={d.toISOString()} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '44px', padding: '4px 3px', cursor: 'pointer', flexShrink: 0 }} onClick={selectDay(d)}>
                                                                {(i === 0 || d.getDate() === 1) && (
                                                                    <div style={{ position: 'absolute', top: '-14px', fontSize: '9px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(245,239,228,0.42)', whiteSpace: 'nowrap' }}>
                                                                        {d.toLocaleDateString('en-US', { month: 'short' })}
                                                                    </div>
                                                                )}
                                                                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'rgba(245,239,228,0.42)' }}>
                                                                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                                                </div>
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-jakarta, sans-serif)', transition: 'background .25s,color .25s', background: isEdge ? ACCENT : inRange ? 'rgba(255,255,255,0.10)' : 'transparent', color: isEdge ? '#fff8f2' : '#F5EFE4' }}>
                                                                    {d.getDate()}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <button onClick={e => { e.stopPropagation(); ribbonRef.current?.scrollBy({ left: 220, behavior: 'smooth' }); }} style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#F5EFE4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                                </button>
                                            </div>
                                        )}

                                        {/* Nights counter */}
                                        {!flexible && nights && (
                                            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: 'rgba(245,239,228,0.6)', textAlign: 'center' }}>
                                                {nights} night{nights === 1 ? '' : 's'}
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
                                                            style={{ padding: '10px 16px', borderRadius: '14px', border: active ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.18)', background: active ? ACCENT : 'transparent', color: active ? '#fff' : '#F5EFE4', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-jakarta, sans-serif)', transition: 'opacity .2s' }}
                                                            onClick={e => { e.stopPropagation(); pickFlex(label)(); }}
                                                        >{label}</button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </NotePanel>
                                )}
                            </span>

                            {', with '}

                            {/* Travelers token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled onClick={openPanel('travelers')} hint={false}>
                                    {travelersValue}
                                </Token>
                                {panelOpen === 'travelers' && (
                                    <NotePanel width="260px" extra={{ textAlign: 'center', maxHeight: 'none' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-fredoka, sans-serif)', marginBottom: '16px' }}>
                                            {mode === 'flights' ? 'How many flying?' : 'How many of you?'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                                            <button onClick={e => { e.stopPropagation(); setTravelersCount(n => Math.max(1, n - 1)); }} disabled={travelers <= 1} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', fontSize: '20px', fontWeight: 600, color: '#F5EFE4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: travelers <= 1 ? 'not-allowed' : 'pointer', opacity: travelers <= 1 ? 0.35 : 1 }}>−</button>
                                            <div style={{ fontSize: '26px', fontWeight: 800, minWidth: '40px', fontFamily: 'var(--font-jakarta, sans-serif)' }}>{travelers}</div>
                                            <button onClick={e => { e.stopPropagation(); setTravelersCount(n => Math.min(16, n + 1)); }} disabled={travelers >= 16} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', fontSize: '20px', fontWeight: 600, color: '#F5EFE4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: travelers >= 16 ? 'not-allowed' : 'pointer', opacity: travelers >= 16 ? 0.35 : 1 }}>+</button>
                                        </div>
                                    </NotePanel>
                                )}
                            </span>
                            {'.'}
                        </div>
                    </div>

                    {/* Results badge */}
                    {ctaState === 'done' && resultsCount && (
                        <div style={{ position: 'absolute', bottom: '8px', right: '150px', background: 'rgba(18,14,28,0.97)', color: '#F5EFE4', padding: '10px 18px', borderRadius: '16px', fontWeight: 700, fontSize: '13px', boxShadow: '0 26px 55px -18px rgba(0,0,0,0.7)', whiteSpace: 'nowrap', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                            {resultsCount.toLocaleString()} {resultsLabel} found
                        </div>
                    )}
                </div>

                {/* ── Stamp CTA ─────────────────────────────────────────── */}
                <button
                    className="imm-stamp"
                    onClick={handleSearch}
                    style={{
                        position: 'absolute', bottom: '-26px', right: '32px',
                        width: '96px', height: '96px', borderRadius: '50%',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                        color: '#fff', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
                        cursor: 'pointer', zIndex: 20,
                        border: '3px dashed rgba(255,255,255,.65)',
                        boxShadow: '0 16px 30px -10px rgba(20,10,35,.55)',
                        background: stampBg, transform: stampTransform,
                        transition: 'background .3s,transform .3s',
                        animation: stampAnimation,
                    }}
                >
                    {ctaState === 'idle' && (
                        <>
                            {mode === 'stays'
                                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.5a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V10" /></svg>
                                : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
                            }
                            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.06em' }}>GO</span>
                        </>
                    )}
                    {ctaState === 'searching' && (
                        <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: 'immSbSpin .8s linear infinite' }}>
                            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                            <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                        </svg>
                    )}
                    {ctaState === 'done' && (
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                    )}
                </button>
            </div>
        </>
    );
}
