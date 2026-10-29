'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchStore } from '@/shared/stores/search.store';
import { autocompleteDestinations } from '@/features/search/api/destinations.api';
import { POPULAR_AIRPORTS } from '@/features/search/lib/popular-airports';
import { excludeOrigin } from '@/features/search/lib/exclude-origin';
import { nightsBetween } from '@/shared/lib/stay';
import { BRAND } from '@/shared/lib/palette';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'stays' | 'flights';
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

/** Every button on the landing page — and anything filled behind white text, like a
 *  picked date — wears v1's blue-to-cyan gradient. */
const FILL = BRAND.gradient;
/** The same gradient as text, for the one button that is only a word ("Clear"). */
const GRADIENT_TEXT: React.CSSProperties = {
    background: BRAND.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
}

function startOfDay(d: Date): Date {
    const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

/**
 * How far the sentence's longest line reaches from its left edge, in px. Wrapped text is as
 * wide as its box, not its words, so the lines are measured instead: the words between the
 * tokens by range, each token by its own box — which leaves out the dropdown hanging off it.
 * 0 where there is no layout to measure (jsdom has no `Range.getClientRects`).
 */
function longestLine(prose: HTMLElement): number {
    const left = prose.getBoundingClientRect().left;
    const range = document.createRange();
    if (typeof range.getClientRects !== 'function') return 0;
    let right = left;
    prose.childNodes.forEach(node => {
        if (node instanceof HTMLElement) {
            right = Math.max(right, node.getBoundingClientRect().right);
        } else if (node.nodeType === Node.TEXT_NODE) {
            range.selectNodeContents(node);
            for (const r of Array.from(range.getClientRects())) right = Math.max(right, r.right);
        }
    });
    return Math.ceil(right - left);
}

// ─── Month-grid calendar ──────────────────────────────────────────────────────

interface CalendarGridProps {
    checkIn:   Date | null;
    checkOut:  Date | null;
    onSelect:  (d: Date) => void;
    accent:    string;
}

function CalendarGrid({ checkIn, checkOut, onSelect, accent }: CalendarGridProps) {
    const today = startOfDay(new Date());
    const [viewYear,  setViewYear]  = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const cells: (Date | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
    ];
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div style={{ userSelect: 'none' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <button onClick={e => { e.stopPropagation(); prevMonth(); }} style={{ border: 'none', background: FILL, color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: BRAND.gradientShadow }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>{monthLabel}</span>
                <button onClick={e => { e.stopPropagation(); nextMonth(); }} style={{ border: 'none', background: FILL, color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: BRAND.gradientShadow }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                {DAY_LABELS.map(l => (
                    <div key={l} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '.04em', color: 'rgba(241,245,249,0.4)', padding: '2px 0' }}>{l}</div>
                ))}
            </div>

            {/* Date grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isPast    = d < today;
                    const isStart   = checkIn  && sameDay(d, checkIn);
                    const isEnd     = checkOut && sameDay(d, checkOut);
                    const inRange   = checkIn && checkOut && d > checkIn && d < checkOut;
                    const isToday   = sameDay(d, today);

                    const bg = (isStart || isEnd)
                        ? accent
                        : inRange
                            ? BRAND.primaryWash
                            : 'transparent';
                    const fg = (isStart || isEnd)
                        ? '#fff'
                        : isPast
                            ? 'rgba(241,245,249,0.2)'
                            : '#f1f5f9';

                    return (
                        <div
                            key={i}
                            onClick={isPast ? undefined : e => { e.stopPropagation(); onSelect(d); }}
                            style={{
                                textAlign: 'center', padding: '5px 0', borderRadius: '8px',
                                fontSize: '13px', fontWeight: isToday ? 700 : 500,
                                background: bg, color: fg,
                                cursor: isPast ? 'default' : 'pointer',
                                outline: isToday && !isStart && !isEnd ? `1.5px solid rgba(241,245,249,0.3)` : 'none',
                                outlineOffset: '-1px',
                                transition: 'background .15s',
                            }}
                            onMouseEnter={e => { if (!isPast && !isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; }}
                            onMouseLeave={e => { if (!isPast && !isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = inRange ? BRAND.primaryWash : 'transparent'; }}
                        >
                            {d.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Shared SVGs ─────────────────────────────────────────────────────────────

function CaretIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Token ────────────────────────────────────────────────────────────────────

interface TokenProps {
    filled: boolean;
    hint: boolean;
    /** Where the token sits in the sentence, 0 first: staggers its caret's bounce into a wave. */
    order: number;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
}

/** Delay between one token's caret bouncing and the next one's, in seconds. */
const CARET_STAGGER = 0.18;

/**
 * A fill-in-the-blank in the sentence. No underline: the dashed and dotted rules read as a
 * rendering glitch rather than a field, so the dropdown chip alone says "this opens" — and
 * bounces, so it reads as something to press rather than as punctuation.
 */
function Token({ filled, hint, order, onClick, children }: TokenProps) {
    return (
        <span
            onClick={onClick}
            className="imm-token cursor-pointer font-bold inline-flex items-center gap-2 transition-opacity duration-300"
            style={{
                opacity: filled ? 1 : 0.92,
                animation: (!filled && hint) ? 'immSbHint 1.6s ease-in-out infinite' : 'none',
            }}
        >
            {children}
            <span
                aria-hidden
                className="imm-token-caret"
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '1.45rem', height: '1.45rem', flexShrink: 0, borderRadius: '9999px',
                    color: '#fff', background: BRAND.gradient, boxShadow: BRAND.gradientShadow,
                    transition: 'transform .2s',
                    animationDelay: `${order * CARET_STAGGER}s`,
                }}
            >
                <CaretIcon />
            </span>
        </span>
    );
}

// ─── Sticky-note panel ────────────────────────────────────────────────────────

const NOTE_GAP = 18;
const NOTE_MAX_HEIGHT = 380;
/** Below this much room under the token, a panel opens above it instead. */
const NOTE_MIN_ROOM = 240;
/** Keeps a panel opening upwards clear of the landing page's fixed navbar. */
const NOTE_TOP_CLEARANCE = 92;
const NOTE_EDGE = 12;

/**
 * The dropdown under a token. Sized and placed against the viewport when it opens: it used to
 * hang a fixed 380px below the token whatever the room, so on a short screen its last rows ran
 * off the bottom and on the right-hand stage its side ran off the edge — rows the visitor
 * could not reach, since the page behind a docked stage does not scroll.
 */
function NotePanel({ children, width = 'min(360px,88vw)', extra = {} }: {
    children: React.ReactNode;
    width?: string;
    extra?: React.CSSProperties;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [fit, setFit] = useState({ above: false, maxHeight: NOTE_MAX_HEIGHT, shift: 0 });

    useLayoutEffect(() => {
        const el = ref.current;
        const anchor = el?.parentElement;
        if (!el || !anchor) return;

        const place = () => {
            const a = anchor.getBoundingClientRect();
            const below = window.innerHeight - a.bottom - NOTE_GAP - NOTE_EDGE;
            const above = a.top - NOTE_GAP - NOTE_TOP_CLEARANCE;
            // A panel that asks for no height cap (dates, travellers) still may not outgrow
            // the screen; it just gets to be as tall as its content when there is room.
            const cap = extra.maxHeight === 'none' ? Infinity : NOTE_MAX_HEIGHT;
            const needs = Math.min(el.scrollHeight + 2, cap, NOTE_MIN_ROOM);
            const flip = below < needs && above > below;
            const room = flip ? above : below;

            // Centred on the token, then pulled back inside the viewport's side edges.
            const centre = a.left + a.width / 2;
            const w = el.offsetWidth;
            const left = Math.min(Math.max(centre - w / 2, NOTE_EDGE), window.innerWidth - w - NOTE_EDGE);

            setFit({
                above: flip,
                maxHeight: Math.max(140, Math.min(cap, room)),
                shift: Math.round(left - (centre - w / 2)),
            });
        };

        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, []);

    return (
        <div ref={ref} className="imm-note" style={{
            position: 'absolute',
            top: fit.above ? 'auto' : `calc(100% + ${NOTE_GAP}px)`,
            bottom: fit.above ? `calc(100% + ${NOTE_GAP}px)` : 'auto',
            left: '50%',
            transform: `translateX(calc(-50% + ${fit.shift}px)) rotate(-0.6deg)`,
            width,
            // Solid: at 98% the sentence behind it ghosted through the list.
            background: '#0f172a',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 26px 55px -18px rgba(0,0,0,0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            zIndex: 40,
            overflowY: 'auto',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            lineHeight: '1.4',
            color: '#f1f5f9',
            ...extra,
            // After `extra`, so a panel asking for no cap is still held to the room there is.
            maxHeight: `${fit.maxHeight}px`,
        }}>
            {/* Paper-fold tab */}
            <div style={{
                position: 'absolute', top: '-10px', left: '28px',
                width: '56px', height: '16px', background: 'rgba(255,255,255,0.14)',
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
}: {
    trendingDestinations?: TrendingDest[];
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
     * When given, picking the *other* tab calls this instead of switching in place. The
     * landing Journey uses it to glide to the sibling stage, whose own bar opens on that
     * mode — so the pill moves the visitor to the section rather than reskinning this one.
     */
    onModeSelect?: (mode: Mode) => void;
    /**
     * Which tab the bar opens on. The landing Journey docks this bar once per stage —
     * stays, then flights — and each stage pins the mode it is about, so the visitor is
     * not asked to find the tab for the thing they just scrolled to. The tab still works.
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
    /** The sentence's longest line, which the search pill runs to; 0 until measured. */
    const [proseWidth, setProseWidth] = useState(0);

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

    // Re-measured whenever the words change or the sentence's box does (a resize, a rewrap),
    // and once the web font lands, since the fallback font sets every line at another width.
    useLayoutEffect(() => {
        const prose = proseRef.current;
        if (!prose) return;
        let live = true;
        const measure = () => { if (live) setProseWidth(longestLine(prose)); };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(prose);
        document.fonts?.ready.then(measure);
        return () => { live = false; ro.disconnect(); };
    }, [mode, originValue, destValue, datesValue, travelersValue]);

    // v1's gradient with white ink. While searching the pill stops pulsing and holds still: its
    // spinner turns and a sheen runs across it (`.imm-stamp[aria-busy]` below) instead.
    const stampAnimation = shake
        ? 'immSbShake 420ms ease'
        : searching
            ? 'none'
            : 'immSbPulse 2.6s ease-in-out infinite';
    const searchingLabel = mode === 'stays' ? tAll('landing.search.searchingStays') : tAll('landing.search.searchingFlights');

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
                /* A panel centred on its token runs off the side of a phone screen,
                   so below the card's breakpoint it docks to the bottom instead.
                   !important because NotePanel positions itself with inline styles. */
                @media (max-width:760px) {
                  .imm-note {
                    position:fixed !important; inset:auto 16px 16px 16px !important;
                    width:auto !important; transform:none !important;
                    max-height:62vh !important;
                  }
                }
            `}</style>

            <div ref={wrapRef} style={{ width: '100%', maxWidth: '900px', position: 'relative', margin: '0 auto' }}>

                {/* ── Container ─────────────────────────────────────────── */}
                {/* Transparent: the prose sits straight on the page canvas, with no
                    surface, wash or border of its own. */}
                <div style={{
                    // Only enough floor to stop the block jumping as the headline
                    // rewraps between modes — with the card gone there is nothing
                    // left to fill, and a taller box just pushed the prose down.
                    position: 'relative', width: '100%',
                    minHeight: 'clamp(220px,26vw,320px)',
                    color: '#fff',
                }}>
                    {/* Content */}
                    <div style={{ position: 'relative', minHeight: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(28px,4.5vw,48px)', gap: '18px', boxSizing: 'border-box' }}>

                        {/* ── Mode tabs ── */}
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(2,6,23,.35)', border: `1px solid ${BRAND.glassBorder}`, backdropFilter: 'blur(24px)', borderRadius: '100px', padding: '4px', gap: '2px' }}>
                            {(['stays', 'flights'] as Mode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={handleSetMode(m)}
                                    style={{
                                        padding: '7px 16px', borderRadius: '100px', border: 'none',
                                        fontSize: '12px', fontWeight: 700, letterSpacing: '.04em',
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

                        {/* ── Prose headline ── */}
                        <div ref={proseRef} style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'clamp(23px,3.4vw,42px)', lineHeight: 1.42, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.35)', maxWidth: '680px' }}>

                            {/* FLIGHTS MODE */}
                            {mode === 'flights' && (
                                <>
                                    {tAll('search.prose.flyFrom')}
                                    {/* Origin token */}
                                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
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
                                    </span>
                                    {tAll('search.prose.to')}
                                </>
                            )}

                            {/* STAYS MODE */}
                            {mode === 'stays' && tAll('search.prose.stayIn')}

                            {' '}

                            {/* Destination token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled={!!pickedDest} hint={hint} order={firstToken} onClick={openPanel('destination')}>
                                    {destValue}
                                </Token>
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
                            </span>

                            {mode === 'flights' ? tAll('search.prose.onDates') : tAll('search.prose.fromDates')}

                            {/* Dates token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled={!!checkIn || !!flexOption} hint={hint} order={firstToken + 1} onClick={openPanel('dates')}>
                                    {datesValue}
                                </Token>
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
                            </span>

                            {tAll('search.prose.withTravelers')}

                            {/* Travelers token */}
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
                                <Token filled onClick={openPanel('travelers')} hint={false} order={firstToken + 2}>
                                    {travelersValue}
                                </Token>
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
                                                    <button onClick={e => { e.stopPropagation(); set((n: number) => Math.max(min, n - 1)); }} disabled={val <= min} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow, fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val <= min ? 'not-allowed' : 'pointer', opacity: val <= min ? 0.3 : 1 }}>−</button>
                                                    <div style={{ fontSize: '18px', fontWeight: 800, minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#f1f5f9' }}>{val}</div>
                                                    <button onClick={e => { e.stopPropagation(); set((n: number) => Math.min(max, n + 1)); }} disabled={val >= max} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: FILL, boxShadow: BRAND.gradientShadow, fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val >= max ? 'not-allowed' : 'pointer', opacity: val >= max ? 0.3 : 1 }}>+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </NotePanel>
                                )}
                            </span>
                            {'.'}
                        </div>

                        {/* ── Search pill ───────────────────────────────── */}
                        {/* Under the sentence and exactly as wide as its longest line,
                            so the pill reads as the sentence's own last line: fill the
                            tokens, then hit GO. Full width until measured.
                            `aria-disabled` rather than `disabled` while searching, so the
                            button keeps keyboard focus; `handleSearch` ignores a second press. */}
                        <button
                            className="imm-stamp"
                            onClick={handleSearch}
                            aria-busy={searching}
                            aria-disabled={searching}
                            style={{
                                position: 'relative', overflow: 'hidden',
                                alignSelf: 'flex-start', flexShrink: 0,
                                width: proseWidth ? `${proseWidth}px` : '100%', maxWidth: '680px',
                                height: '56px', borderRadius: '9999px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700,
                                cursor: searching ? 'progress' : 'pointer', zIndex: 20,
                                border: 'none',
                                boxShadow: '0 16px 30px -10px rgba(37,99,235,.55)',
                                background: FILL,
                                animation: stampAnimation,
                            }}
                        >
                            {searching ? (
                                <>
                                    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'immSbSpin .8s linear infinite' }}>
                                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
                                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
                                    </svg>
                                    <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.04em' }}>{searchingLabel}</span>
                                </>
                            ) : (
                                <>
                                    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                                        <path d="m21.854 2.147-10.94 10.939" />
                                    </svg>
                                    <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.12em' }}>{tAll('landing.search.go')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
