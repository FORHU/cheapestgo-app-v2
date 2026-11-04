'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { BRAND } from '@/shared/lib/palette';

/**
 * The pieces every fill-in-the-blank search sentence on the landing page is made of: the token
 * that opens, the panel it opens, the calendar, and the GO pill under the sentence.
 *
 * Split out of `immersive-search-bar.tsx` when golf got a sentence of its own
 * (`features/golf/components/golf-sentence.tsx`): the two sentences have to look and behave as one
 * bar, and two copies of a token are two copies that drift. The keyframes and hover rules these
 * use (`immSb*`, `.imm-token`, `.imm-stamp`, `.imm-note`) are still declared once, by the bar
 * that renders every sentence.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Every button on the landing page — and anything filled behind white text, like a
 *  picked date — wears v1's blue-to-cyan gradient. */
export const FILL = BRAND.gradient;
/** The same gradient as text, for the one button that is only a word ("Clear"). */
export const GRADIENT_TEXT: React.CSSProperties = {
    background: BRAND.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
};

/** The sentence itself: large, white, shadowed enough to hold over a photograph. */
export const PROSE: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'clamp(23px,3.4vw,42px)', lineHeight: 1.42,
    color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.35)', maxWidth: '680px',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function sameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
}

export function startOfDay(d: Date): Date {
    const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

/**
 * How far the sentence's longest line reaches from its left edge, in px. Wrapped text is as
 * wide as its box, not its words, so the lines are measured instead: the words between the
 * tokens by range, each token by its own box — which leaves out the dropdown hanging off it.
 * 0 where there is no layout to measure (jsdom has no `Range.getClientRects`).
 */
export function longestLine(prose: HTMLElement): number {
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

/**
 * The sentence's longest line, which the GO pill runs to; 0 until measured.
 *
 * Re-measured whenever `deps` change (the words, the mode) or the sentence's box does (a resize, a
 * rewrap), and once the web font lands, since the fallback font sets every line at another width.
 */
export function useProseWidth(ref: React.RefObject<HTMLElement | null>, deps: React.DependencyList): number {
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const prose = ref.current;
        if (!prose) return;
        let live = true;
        const measure = () => { if (live) setWidth(longestLine(prose)); };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(prose);
        document.fonts?.ready.then(measure);
        return () => { live = false; ro.disconnect(); };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    return width;
}

// ─── Month-grid calendar ──────────────────────────────────────────────────────

interface CalendarGridProps {
    checkIn:   Date | null;
    checkOut:  Date | null;
    onSelect:  (d: Date) => void;
    accent:    string;
    /** The last day that may be picked; later days are drawn like past ones. None by default. */
    maxDate?:  Date | null;
}

export function CalendarGrid({ checkIn, checkOut, onSelect, accent, maxDate = null }: CalendarGridProps) {
    const today = startOfDay(new Date());
    const last = maxDate ? startOfDay(maxDate) : null;
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
                    const isPast    = d < today || (last !== null && d > last);
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
                            aria-disabled={isPast || undefined}
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

export function SearchMiniIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.2-3.2" />
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
export function Token({ filled, hint, order, onClick, children }: TokenProps) {
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
export function NotePanel({ children, width = 'min(360px,88vw)', extra = {} }: {
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

// ─── Search pill ──────────────────────────────────────────────────────────────

/**
 * The GO pill. Under the sentence and exactly as wide as its longest line (`width`), so the pill
 * reads as the sentence's own last line: fill the tokens, then hit GO. Full width until measured.
 *
 * v1's gradient with white ink. While searching the pill stops pulsing and holds still: its
 * spinner turns and a sheen runs across it (`.imm-stamp[aria-busy]`) instead. `aria-disabled`
 * rather than `disabled` while searching, so the button keeps keyboard focus; the caller ignores a
 * second press.
 */
export function GoPill({ onClick, searching, shake, width, label, searchingLabel }: {
    onClick: (e: React.MouseEvent) => void;
    searching: boolean;
    shake: boolean;
    width: number;
    label: string;
    searchingLabel: string;
}) {
    const animation = shake
        ? 'immSbShake 420ms ease'
        : searching
            ? 'none'
            : 'immSbPulse 2.6s ease-in-out infinite';
    return (
        <button
            className="imm-stamp"
            onClick={onClick}
            aria-busy={searching}
            aria-disabled={searching}
            style={{
                position: 'relative', overflow: 'hidden',
                alignSelf: 'flex-start', flexShrink: 0,
                width: width ? `${width}px` : '100%', maxWidth: '680px',
                height: '56px', borderRadius: '9999px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700,
                cursor: searching ? 'progress' : 'pointer', zIndex: 20,
                border: 'none',
                boxShadow: '0 16px 30px -10px rgba(37,99,235,.55)',
                background: FILL,
                animation,
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
                    <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.12em' }}>{label}</span>
                </>
            )}
        </button>
    );
}
