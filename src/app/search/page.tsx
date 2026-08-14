'use client';

import React, { useEffect, useRef, useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { MappableProperty } from '@/shared/components/map/types';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import { env } from '@/shared/lib/env';
import { useUserCurrency } from '@/stores/searchStore';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { ArrowLeft, List, Building2, ChevronDown, ChevronUp, Sun, Moon, Search, MapPin } from 'lucide-react';
import { useTheme } from '@/shared/components/ThemeContext';
import { useMapboxSearch } from '@/shared/components/mapbox/hooks/useMapboxSearch';


const DISTRICT_MARKER_THRESHOLD = 11;

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT        = '#FF6B4B';
const TEXT          = '#F5EFE4';
const BG            = '#15111E';
const BORDER        = 'rgba(255,255,255,0.08)';
const DIM           = 'rgba(245,239,228,0.45)';
const OVERLAY_BG    = 'rgba(28,23,36,0.82)';
const OVERLAY_BDR   = 'rgba(255,255,255,0.15)';

const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then(m => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full" style={{ background: '#1B2A2E' }} /> }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
type ViewMode = 'map' | 'list';
type SortValue = 'recommended' | 'price-low' | 'price-high' | 'rating' | 'most-reviewed';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'recommended',   label: 'Recommended' },
    { value: 'price-low',     label: 'Cheapest first' },
    { value: 'rating',        label: 'Top Rated' },
    { value: 'most-reviewed', label: 'Most Reviewed' },
    { value: 'price-high',    label: 'Price: High to Low' },
];

// ─── Adapter ─────────────────────────────────────────────────────────────────
function toMappable(h: any): MappableProperty | null {
    const lat = h.lat ?? h.latitude ?? h.coordinates?.lat;
    const lng = h.lng ?? h.longitude ?? h.coordinates?.lng;
    if (!lat || !lng) return null;
    return {
        id: h.id ?? h.hotelId,
        name: h.name,
        price: typeof h.price === 'number' ? h.price : parseFloat(h.price ?? '0'),
        currency: h.currency ?? 'USD',
        coordinates: { lat: Number(lat), lng: Number(lng) },
        images: h.images?.length ? h.images : h.thumbnailUrl ? [h.thumbnailUrl] : [],
        image: h.images?.[0] ?? h.thumbnailUrl ?? (h.image || undefined),
        rating: h.reviewScore ?? h.reviewRating ?? h.rating,
        reviewScore: h.reviewScore ?? h.reviewRating,
        reviewCount: h.reviewCount ?? h.reviews,
        refundableTag: h.refundableTag,
        starRating: h.starRating,
        location: h.location,
        city: h.city,
        country: h.country,
        boardType: h.boardType,
        priceLoading: h.priceLoading,
        originalPrice: h.originalPrice,
    };
}

function sortHotels(list: MappableProperty[], by: SortValue): MappableProperty[] {
    const c = [...list];
    if (by === 'price-low')     c.sort((a, b) => a.price - b.price);
    if (by === 'price-high')    c.sort((a, b) => b.price - a.price);
    if (by === 'rating')        c.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (by === 'most-reviewed') c.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return c;
}

function fmtPill(destination: string, checkIn: string, checkOut: string, adults: string, children: string) {
    const parts: string[] = [];
    if (destination) parts.push(destination);
    if (checkIn && checkOut) {
        const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        parts.push(`${fmt(checkIn)} – ${fmt(checkOut)}`);
    }
    const guests = (Number(adults) || 2) + (Number(children) || 0);
    parts.push(`${guests} guest${guests !== 1 ? 's' : ''}`);
    return parts.join(' | ');
}

// ─── Bottom rail card ─────────────────────────────────────────────────────────
// Geometry is the design's own, scaled from its 345px artboard: image 0.58 of
// the width, price circle 0.30, panel the remainder. The circle straddles the
// image/panel seam and runs a few px past the right edge, where the card's
// `overflow: hidden` crops it.
//
// The price sits on ONE line inside the circle, and the circle scales with the
// card — so the width used to be pinned here, because below it the label ran
// out of circle. `priceFontFor` now sizes the label from the room actually
// available instead, which is what lets this be tuned freely.

const CARD_W = 196;
const CARD_REF_W = 320;
const SCALE = CARD_W / CARD_REF_W;
/** Geometry: whole pixels. */
const px = (n: number) => Math.round(n * SCALE);
/**
 * Type does not follow the geometry all the way down. Scaled linearly, a 190px
 * card puts the title at 8px and the price at 6px — proportionally right and
 * unreadable. The floor keeps text legible while the card is free to shrink;
 * above roughly CARD_W 290 the floor stops binding and type is proportional
 * again.
 */
const TYPE_SCALE = Math.max(SCALE, 0.9);
const fpx = (n: number) => Math.round(n * TYPE_SCALE * 10) / 10;

const CARD_IMG_H   = px(160);
const PRICE_CIRCLE = px(97);
const PANEL_PAD_X  = px(17);
/** A floor, not a fixed height — the panel grows if the type needs the room. */
const PANEL_HEIGHT = px(124);
/** Roughly the card's finished height. */
const CARD_H = CARD_IMG_H + PANEL_HEIGHT;
/** How much a selected card grows. */
const SELECT_SCALE = 1.15;
/** Half the horizontal growth — applied as margin either side of the selected
 *  card so its neighbours slide out of the way instead of being covered.
 *  `transform` alone paints over them without moving them. */
const SELECT_GUTTER = Math.round((CARD_W * (SELECT_SCALE - 1)) / 2);
/** Vertical growth the rail must leave clear above the cards. */
const SELECT_HEADROOM = Math.ceil(CARD_H * (SELECT_SCALE - 1));

/**
 * Largest size at which `label` still fits on one line inside the price circle.
 *
 * The ramp this replaces stepped on character count alone — 10.5 up to 14
 * characters, then down — which held only at the width the design was drawn
 * at. The circle scales with the card, so the same 14-character label that fit
 * at 220 overflowed at 196. Sizing from the room available keeps the design's
 * type at full size whenever it fits and steps down only when it genuinely
 * has to, at any card width.
 *
 * `AVG_CHAR_EM` is a rough advance width for the UI face — close enough for a
 * label of digits and a short word, and erring small.
 */
const AVG_CHAR_EM = 0.54;
const PRICE_PAD   = 8;
function priceFontFor(label: string): number {
    const room = PRICE_CIRCLE - PRICE_PAD;
    const fitted = room / Math.max(1, label.length * AVG_CHAR_EM);
    // Never above the design's size, never below legibility.
    return Math.max(6.5, Math.min(fpx(10.5), Math.round(fitted * 10) / 10));
}

/** How far the circle runs past the right edge before the crop. */
const CIRCLE_BLEED = -18;
/** The name shares a line with the circle's lower arc, so it stops short of it. */
const NAME_PAD_R   = PRICE_CIRCLE - CIRCLE_BLEED + px(8) - PANEL_PAD_X;

/**
 * The card takes its palette from the app theme rather than from the page's
 * `dark` class: the search page hardcodes that class on its root, so a `dark:`
 * variant would never resolve to the light design.
 */
function railCardPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        surface: dark ? '#1A1A1A' : '#FFFFFF',
        title:   dark ? '#FFFFFF' : '#111111',
        muted:   dark ? 'rgba(255,255,255,0.60)' : '#6B7280',
        hairline: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        imageBg: dark ? 'rgba(255,255,255,0.05)' : '#F1F1F1',
        // The price circle and the View Stay button invert the panel.
        chipBg:   dark ? '#FFFFFF' : '#1A1A1A',
        chipText: dark ? '#111111' : '#FFFFFF',
        /** `chipText` at low alpha — the unlit part of a ring drawn on a chip. */
        chipTrack: dark ? 'rgba(17,17,17,0.20)' : 'rgba(255,255,255,0.20)',
    };
}

function RailCard({
    property, isSelected, isHovered, shiftLeft, shiftRight,
    onSelect, onHover, onViewDetails, currency, theme,
}: {
    property: MappableProperty; isSelected: boolean; isHovered: boolean;
    /** Room a grown neighbour needs on this card's left / right. */
    shiftLeft: number; shiftRight: number;
    onSelect: (id: string) => void; onHover: (id: string | null) => void;
    onViewDetails: (id: string) => void;
    currency: string; theme: 'light' | 'dark';
}) {
    const c = railCardPalette(theme);
    const price = convertCurrency(property.price, property.currency || 'USD', currency);
    const priceStr = formatCurrency(price, currency);
    const rating = property.rating ?? 0;
    const enlarged = isSelected || isHovered;

    // One line, as designed. KRW and JPY run long enough to overrun the circle,
    // so the label steps down a size rather than wrapping.
    const priceLine = `${priceStr}/ night`;
    const priceFont = priceFontFor(priceLine);

    return (
        <div
            onClick={() => onSelect(property.id)}
            onMouseEnter={() => onHover(property.id)}
            onMouseLeave={() => onHover(null)}
            className="shrink-0 cursor-pointer"
            style={{
                position: 'relative',
                width: CARD_W, borderRadius: px(16), overflow: 'hidden',
                background: c.surface,
                border: '',
                boxShadow: 'none',
                // Selection and hover both read as scale, not an outline. Anchored
                // bottom-centre so the card grows up into the map.
                transform: enlarged ? `scale(${SELECT_SCALE})` : 'scale(1)',
                transformOrigin: 'center bottom',
                // The margins sit on the NEIGHBOURS of a grown card, never on the
                // card itself. Margin on the grown card would shift it sideways,
                // sliding it out from under the cursor — which un-hovers it,
                // shrinks it back under the cursor, and flickers forever.
                marginLeft: shiftLeft,
                marginRight: shiftRight,
                zIndex: isSelected ? 5 : isHovered ? 4 : 1,
                transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), margin 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                // The rail is pointer-transparent so its scale headroom doesn't
                // block the map; the cards themselves opt back in.
                pointerEvents: 'auto',
            }}
        >
            {/* Image */}
            <div style={{ height: CARD_IMG_H, position: 'relative', background: c.imageBg }}>
                {property.image ? (
                    <Image src={property.image} alt={property.name} fill className="object-cover" sizes="320px" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Building2 size={26} style={{ color: c.muted }} />
                    </div>
                )}
                {property.refundableTag === 'RFN' && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: '#2FB67F', zIndex: 2 }}>
                        Free cancel
                    </span>
                )}
            </div>

            {/* Price circle*/}
            <div className="absolute flex items-center justify-center" style={{
                width: PRICE_CIRCLE, height: PRICE_CIRCLE, borderRadius: '50%',
                top: CARD_IMG_H - PRICE_CIRCLE / 2, right: -CIRCLE_BLEED, zIndex: 10,
                background: c.chipBg,
                boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
            }}>
                {property.priceLoading ? (
                    <div className="animate-pulse rounded-full" style={{ width: px(42), height: px(11), background: 'rgba(128,128,128,0.35)' }} />
                ) : (
                    <span style={{
                        fontSize: priceFont, fontWeight: 700, color: c.chipText,
                        whiteSpace: 'nowrap', lineHeight: 1.2,
                        // Only when the circle is cropped: shifts the label left of
                        // true centre so it sits centred in the visible part.
                        paddingRight: Math.max(0, CIRCLE_BLEED * 2),
                    }}>
                        {priceLine}
                    </span>
                )}
            </div>

            {/* Panel */}
            <div style={{ minHeight: PANEL_HEIGHT, display: 'flex', flexDirection:'column', padding: `${px(30)}px ${PANEL_PAD_X}px ${px(18)}px`, background: c.surface }}>
                <h3 style={{
                    fontSize: fpx(14), fontWeight: 700, color: c.title, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: NAME_PAD_R,
                }}>
                    {property.name}
                </h3>
                {/* Both rows always render, falling back to a non-breaking space.
                    Rendered conditionally they collapsed, so a hotel with no
                    rating produced a shorter card than its neighbours and the
                    rail's baseline went ragged. */}
                <p style={{
                    fontSize: fpx(11), color: c.muted, marginTop: px(4), lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {property.location ?? property.city ?? ' '}
                </p>
                <p style={{ fontSize: fpx(11), color: c.muted, marginTop: px(8), lineHeight: 1.35 }}>
                    {rating > 0 ? `${rating.toFixed(1)} rating` : ' '}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(property.id); }}
                        style={{
                            background: c.chipBg, color: c.chipText, border: 'none',
                            borderRadius: 100, padding: `${px(10)}px ${px(21)}px`,
                            fontSize: fpx(12), fontWeight: 600, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}>
                        View Stay
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
/**
 * Four states, per the design:
 *
 *   inactive  — 'Where to next? Try "Phuket Town"...'   nothing searched yet
 *   selected  — empty field, caret, suggestions          focused
 *   searching — "Searching..."                           a search is in flight
 *   searched  — "Gangnam District | …"                   the current search
 *
 * Every state but `selected` renders muted text, so those three drive the
 * placeholder and leave the value empty. Focus deliberately clears the summary
 * rather than seeding the field with it: the design's selected state is an
 * empty bar, and typing over a long summary is worse anyway.
 *
 * Suggestions come from the same debounced Mapbox geocoder the map overlay
 * uses, so picking one carries real coordinates through to the search rather
 * than a bare string the API has to re-resolve.
 */
function SearchBar({
    summary, searching, theme, proximity, onSubmit,
}: {
    summary: string; searching: boolean; theme: 'light' | 'dark';
    proximity?: { lat: number; lng: number };
    onSubmit: (name: string, coords?: { lat: number; lng: number }) => void;
}) {
    const [focused, setFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dark = theme === 'dark';
    const p = sortPalette(theme);
    const muted = dark ? 'rgba(245,245,245,0.55)' : 'rgba(17,17,17,0.45)';

    const {
        originQuery, originResults, showOriginResults, setShowOriginResults,
        isSearching: suggesting, handleOriginSearch, clearSearch,
    } = useMapboxSearch({ proximity });

    const state = focused ? 'selected' : searching ? 'searching' : summary ? 'searched' : 'inactive';
    const placeholder =
        state === 'searching' ? 'Searching...' :
        state === 'searched'  ? summary :
        state === 'inactive'  ? 'Where to next? Try "Phuket Town"...' : '';

    const suggestions = focused && showOriginResults ? originResults : [];

    const close = useCallback(() => {
        setFocused(false);
        setActiveIndex(-1);
        clearSearch();
    }, [clearSearch]);

    // Click-away closes the panel. Focus alone is not enough: picking a
    // suggestion uses mousedown, which fires before blur.
    useEffect(() => {
        if (!focused) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [focused, close]);

    const submit = (name: string, coords?: { lat: number; lng: number }) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        inputRef.current?.blur();
        close();
        onSubmit(trimmed, coords);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { inputRef.current?.blur(); close(); return; }
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i <= 0 ? suggestions.length : i) - 1);
        }
    };

    return (
        // Grows into the toolbar's free space but stops short of hogging it —
        // the design keeps the controls that follow close to the field.
        <div ref={wrapRef} className="relative min-w-0" style={{ flex: '1 1 auto', maxWidth: 470 }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
                    if (picked) submit(picked.name, { lat: picked.lat, lng: picked.lng });
                    else submit(originQuery);
                }}
                className="flex items-center gap-3 rounded-full"
                style={{
                    height: 40, padding: '0 18px',
                    background: p.field,
                    border: `1px solid ${p.border}`,
                    boxShadow: focused
                        ? `0 0 0 2px ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.14)'}`
                        : 'none',
                    transition: 'box-shadow .15s',
                }}
            >
                <Search size={16} style={{ color: muted, flexShrink: 0 }} />
                <input
                    ref={inputRef}
                    value={focused ? originQuery : ''}
                    onChange={(e) => { handleOriginSearch(e.target.value); setActiveIndex(-1); }}
                    onFocus={() => setFocused(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    aria-label="Search for hotels"
                    aria-expanded={suggestions.length > 0}
                    aria-autocomplete="list"
                    role="combobox"
                    className="flex-1 min-w-0 bg-transparent outline-none"
                    style={{ fontSize: 14, color: p.text, caretColor: p.text }}
                />
                {focused && suggesting && (
                    <span className="animate-spin shrink-0" style={{
                        width: 13, height: 13, borderRadius: '50%',
                        border: `1.5px solid ${p.border}`, borderTopColor: p.text,
                    }} />
                )}
            </form>

            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.ul
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        role="listbox"
                        className="absolute left-0 right-0 z-50 overflow-hidden"
                        style={{
                            top: '100%', marginTop: 8, borderRadius: 18,
                            background: p.menu, border: `1px solid ${p.border}`,
                            boxShadow: p.shadow,
                        }}
                    >
                        {suggestions.map((r, i) => (
                            <li key={r.id} role="option" aria-selected={i === activeIndex}>
                                <button
                                    type="button"
                                    // mousedown, not click: the input's blur would
                                    // otherwise tear the list down first.
                                    onMouseDown={(e) => { e.preventDefault(); submit(r.name, { lat: r.lat, lng: r.lng }); }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className="flex w-full items-center gap-3 text-left"
                                    style={{
                                        padding: '11px 18px', fontSize: 13,
                                        color: p.text,
                                        opacity: i === activeIndex ? 1 : 0.75,
                                        background: i === activeIndex ? p.hover : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <MapPin size={14} style={{ color: muted, flexShrink: 0 }} />
                                    <span className="truncate">{r.name}</span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────
/**
 * The map's chrome, as three tones rather than one: the toolbar `bar` is the
 * ground, the controls sitting on it are a step lighter (`surface`), and the
 * search `field` is a step darker still, which is what makes it read as an
 * input rather than another button.
 */
function sortPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        bar:     dark ? '#16171A' : '#ECECEF',
        surface: dark ? '#232428' : '#FFFFFF',
        field:   dark ? '#000000' : '#FFFFFF',
        text:    dark ? '#FFFFFF' : '#111111',
        border:  dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        menu:    dark ? '#1B1C20' : '#FFFFFF',
        hover:   dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        shadow:  dark ? '0 8px 28px rgba(0,0,0,0.55)' : '0 8px 24px rgba(15,23,42,0.16)',
    };
}

function SortPill({ value, onChange, theme }: { value: SortValue; onChange: (v: SortValue) => void; theme: 'light' | 'dark' }) {
    const [open, setOpen] = useState(false);
    const p = sortPalette(theme);
    const label = SORT_OPTIONS.find(o => o.value === value)?.label ?? 'Recommended';

    return (
        <div style={{ position: 'relative' }}>
            {/* No shadow: this sits on the toolbar, not over the map. */}
            <button onClick={() => setOpen(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: p.surface, border: `1px solid ${p.border}`,
                borderRadius: 100, padding: '0 16px', height: 40,
                color: p.text, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
                {label}
                <ChevronDown size={14} style={{ opacity: 0.75, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 8,
                            zIndex: 100, minWidth: 186, borderRadius: 16, overflow: 'hidden',
                            background: p.menu, border: `1px solid ${p.border}`,
                            boxShadow: p.shadow,
                        }}>
                        {SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = p.hover; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    padding: '11px 16px', fontSize: 12.5,
                                    fontWeight: value === opt.value ? 700 : 500,
                                    color: p.text, opacity: value === opt.value ? 1 : 0.72,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    transition: 'background .12s',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Full-screen status ───────────────────────────────────────────────────────
/**
 * The two states the search page can be in besides "showing results": looking,
 * and having found nothing.
 *
 * The designs are the same screen — flat ground, a near-black badge, a title,
 * muted lines beneath it — differing only in copy and whether an action
 * follows. So they are one component rather than two overlays that have to be
 * kept in step by hand; the pair drifted apart last time precisely because
 * they were maintained separately.
 *
 * Opaque, not a tinted scrim over the map: the design is a page of its own,
 * and letting the basemap through put a moving, multi-coloured field behind
 * type that is deliberately low-contrast.
 */
function StatusScreen({
    busy, title, lines, action, theme,
}: {
    /** Work is in flight: the badge carries a spinner. Omitted, it sits still. */
    busy?: boolean;
    title: string;
    lines: string[];
    action?: { label: string; onClick: () => void };
    theme: 'light' | 'dark';
}) {
    // The same palette the rail cards use, so the status ground is the card
    // surface rather than a colour of its own. The badge and the button then
    // take the chip pair — the inversion the cards already apply to the price
    // circle and View Stay — which keeps the mark legible whichever way the
    // surface goes, instead of a fixed near-black that vanishes on a dark one.
    const c = railCardPalette(theme);

    return (
        <div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center"
            style={{ background: c.surface }}
        >
            {/* The disc is the design's static mark, so the activity goes inside
                it — a ring orbiting the glyph — rather than around it, which
                would blur the badge's own edge. The failed state gets the bare
                badge.

                The faint track is doing work: without it the bright head reads
                as a lone arc drifting on the disc rather than as travel around
                a circle. */}
            <div
                className="relative flex items-center justify-center rounded-full"
                style={{ width: 64, height: 64, background: c.chipBg }}
            >
                {busy && (
                    <span
                        aria-hidden="true"
                        className="absolute animate-spin rounded-full"
                        style={{
                            inset: 5,
                            border: `2px solid ${c.chipTrack}`,
                            borderTopColor: c.chipText,
                            animationDuration: '0.9s',
                        }}
                    />
                )}
                <Building2 size={24} style={{ color: c.chipText }} />
            </div>

            <p style={{ fontSize: 19, fontWeight: 500, color: c.title, marginTop: 20 }}>
                {title}
            </p>

            {lines.map((line, i) => (
                <p key={line} style={{
                    fontSize: 13, color: c.muted,
                    lineHeight: 1.4, marginTop: i === 0 ? 10 : 6,
                }}>
                    {line}
                </p>
            ))}

            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="inline-flex items-center justify-center cursor-pointer transition-opacity hover:opacity-85"
                    style={{
                        marginTop: 32, height: 62, padding: '0 52px',
                        background: c.chipBg, color: c.chipText, border: 'none',
                        borderRadius: 100, fontSize: 17, fontWeight: 500,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
                    }}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function HotelSearchContent() {
    const searchParams = useSearchParams();
    const router       = useRouter();

    const destination  = searchParams.get('destination')  ?? '';
    const checkIn      = searchParams.get('checkIn')      ?? '';
    const checkOut     = searchParams.get('checkOut')     ?? '';
    const adults       = searchParams.get('adults')       ?? '2';
    const children     = searchParams.get('children')     ?? '0';
    const rooms        = searchParams.get('rooms')        ?? '1';
    const lat          = searchParams.get('lat')          ?? '';
    const lng          = searchParams.get('lng')          ?? '';
    const countryCode  = searchParams.get('countryCode')  ?? '';
    const bboxParam    = searchParams.get('bbox')         ?? '';
    const districtName = searchParams.get('districtName') ?? '';
    const canonicalCity = searchParams.get('canonicalCity') ?? '';
    const searchQs    = searchParams.toString();

    const [hotels, setHotels]                   = useState<MappableProperty[]>([]);
    const [status, setStatus]                   = useState<StreamStatus>('idle');
    const [viewMode, setViewMode]               = useState<ViewMode>('map');
    const [sortBy, setSortBy]                   = useState<SortValue>('recommended');
    const [selectedId, setSelectedId]           = useState<string | null>(null);
    const [hoveredId, setHoveredId]             = useState<string | null>(null);
    const [mapZoom, setMapZoom]                 = useState(11);
    const [showAllCityOverride, setShowAllCityOverride] = useState(false);
    const [railHidden, setRailHidden]           = useState(false);
    const [mapCenter, setMapCenter]             = useState<{ lat: number; lng: number } | undefined>(
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined
    );
    const [geocodedCoords, setGeocodedCoords]   = useState<{ lat: number; lng: number } | null>(null);

    const districtBbox = useMemo<[number, number, number, number] | undefined>(() => {
        if (!bboxParam) return undefined;
        const parts = bboxParam.split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return undefined;
        return parts as [number, number, number, number];
    }, [bboxParam]);

    const currency   = useUserCurrency();
    const { theme, toggleTheme } = useTheme();
    /**
     * The UI runs opposite the app theme, so it always contrasts the basemap:
     * light mode gets a light map under dark chrome and dark cards, dark mode
     * the reverse. Everything on top of the map takes `uiTone`, never `theme`.
     */
    const uiTone     = theme === 'dark' ? 'light' : 'dark';
    /** One surface for every control floating over the map. */
    const chrome     = sortPalette(uiTone);
    const searchKey  = `${destination}|${checkIn}|${checkOut}|${adults}|${children}|${rooms}|${lat}|${lng}`;

    useEffect(() => {
        if (!destination && !lat) return;
        let cancelled = false;
        let accumulated = 0;
        const ctrl = new AbortController();
        setStatus('loading');
        setHotels([]);
        setSelectedId(null);
        setMapCenter(lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined);

        const searchLat = lat ? Number(lat) : null;
        const searchLng = lng ? Number(lng) : null;
        // Drop hotels that are clearly outside the searched area (> 150 km away).
        // This prevents worldwide TGX portfolio results from appearing on a city search
        // and keeps the map correctly centred on the destination.
        const isNearby = (h: MappableProperty) => {
            if (!searchLat || !searchLng) return true;
            const dlat = h.coordinates.lat - searchLat;
            const dlng = h.coordinates.lng - searchLng;
            return Math.sqrt(dlat * dlat + dlng * dlng) * 111 <= 150;
        };

        const run = async () => {
            const body: Record<string, any> = {
                destination, checkIn, checkOut,
                adults: Number(adults), children: Number(children), rooms: Number(rooms),
            };
            if (lat) body.lat = Number(lat);
            if (lng) body.lng = Number(lng);
            if (countryCode) body.countryCode = countryCode;

            const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/hotels/search/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal,
                credentials: 'include',
            });

            if (!res.ok || !res.body) { if (!cancelled) setStatus('error'); return; }

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done || cancelled) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const t = line.trim();
                    if (!t) continue;
                    const json = t.startsWith('data: ') ? t.slice(6) : t;
                    try {
                        const chunk = JSON.parse(json);
                        const list: any[] = Array.isArray(chunk.data) ? chunk.data : Array.isArray(chunk.hotels) ? chunk.hotels : [];
                        if ((chunk.type === 'instant' || chunk.type === 'hotels') && list.length > 0) {
                            accumulated += list.length;
                            const mapped = list.map(toMappable).filter((h): h is MappableProperty => !!h && isNearby(h));
                            if (!cancelled) { setHotels(prev => { const m = new Map(prev.map(h => [h.id, h])); for (const h of mapped) m.set(h.id, h); return Array.from(m.values()); }); setStatus('streaming'); }
                        } else if (chunk.type === 'prices' && Array.isArray(chunk.data)) {
                            const pm = new Map<string, any>(chunk.data.map((p: any) => [p.hotelId, p]));
                            if (!cancelled) setHotels(prev => prev.map(h => { const p = pm.get(h.id); return p ? { ...h, price: p.price ?? h.price, currency: p.currency ?? h.currency, priceLoading: false } : h; }));
                        } else if (chunk.type === 'remove' && Array.isArray(chunk.ids)) {
                            const s = new Set(chunk.ids as string[]);
                            if (!cancelled) setHotels(prev => prev.filter(h => !s.has(h.id)));
                        } else if (chunk.type === 'done' || chunk.type === 'error') {
                            if (!cancelled) { setHotels(prev => prev.map(h => h.priceLoading ? { ...h, priceLoading: false } : h)); setStatus(accumulated > 0 ? 'done' : 'error'); } return;
                        }
                    } catch { /* skip */ }
                }
            }
            if (!cancelled) setStatus(accumulated > 0 ? 'done' : 'error');
        };

        run().catch(err => { if (!cancelled && err?.name !== 'AbortError') setStatus('error'); });
        return () => { cancelled = true; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    // Resolve destination → coordinates when URL has no lat/lng.
    // Uses /hotels/suggest which hits Mapbox and is proven to return city coords.
    useEffect(() => {
        setGeocodedCoords(null);
        if (lat && lng) return;
        if (!destination) return;
        const apiBase = env.NEXT_PUBLIC_API_URL;
        if (!apiBase) return;
        let cancelled = false;
        fetch(`${apiBase}/hotels/suggest?q=${encodeURIComponent(destination)}`)
            .then(r => r.json())
            .then((data: any) => {
                if (cancelled) return;
                const city = (data?.destinations ?? []).find(
                    (d: any) => d.type === 'city' && typeof d.lat === 'number' && typeof d.lng === 'number'
                );
                if (city) setGeocodedCoords({ lat: city.lat, lng: city.lng });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [destination, lat, lng]);

    // Auto-center on geocoded coords or first hotel when no lat/lng were in the URL
    useEffect(() => {
        if (mapCenter) return;
        if (geocodedCoords) { setMapCenter(geocodedCoords); return; }
        const first = hotels.find(h => h.coordinates);
        if (first?.coordinates) setMapCenter(first.coordinates);
    }, [hotels, mapCenter, geocodedCoords]);

    const effectiveLat = lat ? Number(lat) : geocodedCoords?.lat ?? null;
    const effectiveLng = lng ? Number(lng) : geocodedCoords?.lng ?? null;

    const sorted = useMemo(() => {
        let base = hotels;
        if (effectiveLat && effectiveLng) {
            base = hotels.filter(h => {
                const dlat = h.coordinates.lat - effectiveLat;
                const dlng = h.coordinates.lng - effectiveLng;
                return Math.sqrt(dlat * dlat + dlng * dlng) * 111 <= 150;
            });
        }
        return sortHotels(base, sortBy);
    }, [hotels, sortBy, effectiveLat, effectiveLng]);

    // Pre-convert prices to the user's preferred currency for the list view
    // so HotelCard renders the same currency as the map rail cards.
    const listHotels = useMemo(() =>
        sorted.map(h => ({
            ...h,
            price: Math.round(convertCurrency(h.price, h.currency || 'USD', currency)),
            currency,
        })),
    [sorted, currency]);
    const railSorted = useMemo(() => {
        if (!districtBbox || showAllCityOverride || mapZoom < DISTRICT_MARKER_THRESHOLD) return sorted;
        const [minLng, minLat, maxLng, maxLat] = districtBbox;
        return sorted.filter(p =>
            p.coordinates.lng >= minLng && p.coordinates.lng <= maxLng &&
            p.coordinates.lat >= minLat && p.coordinates.lat <= maxLat
        );
    }, [sorted, districtBbox, showAllCityOverride, mapZoom]);
    const count   = railSorted.length;

    /**
     * A grown card — selected or hovered — spreads half its extra width to each
     * side. That room is taken by its neighbours rather than by the card itself,
     * so the grown card never moves under the cursor.
     */
    const railCards = useMemo(() => {
        const shown = railSorted.slice(0, 50);
        const grown = new Set<number>();
        shown.forEach((p, i) => {
            if (p.id === selectedId || p.id === hoveredId) grown.add(i);
        });
        return shown.map((property, i) => ({
            property,
            isSelected: property.id === selectedId,
            isHovered:  property.id === hoveredId,
            shiftLeft:  grown.has(i - 1) ? SELECT_GUTTER : 0,
            shiftRight: grown.has(i + 1) ? SELECT_GUTTER : 0,
        }));
    }, [railSorted, selectedId, hoveredId]);
    const isLoading    = status === 'loading';
    const isStreaming  = status === 'streaming';
    const pillText     = fmtPill(destination, checkIn, checkOut, adults, children);

    const handleViewDetails = useCallback((id: string) => router.push(`/property/${id}?${searchQs}`), [router, searchQs]);

    // A new destination invalidates the coordinates and the district scoping the
    // old one came with, so those params are dropped. Coordinates are then put
    // back only when the query came from a geocoded suggestion.
    const handleSearchSubmit = useCallback((name: string, coords?: { lat: number; lng: number }) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('destination', name);
        for (const stale of ['lat', 'lng', 'countryCode', 'bbox', 'districtName', 'canonicalCity']) {
            params.delete(stale);
        }
        if (coords) {
            params.set('lat', String(coords.lat));
            params.set('lng', String(coords.lng));
        }
        router.push(`/search?${params.toString()}`);
    }, [router, searchParams]);
    const handleSelect      = useCallback((id: string) => setSelectedId(prev => prev === id ? null : id), []);

    // Wheel over the rail scrolls the cards horizontally and never reaches the
    // map's zoom.
    //
    // Listening on the window in the CAPTURE phase, gated on the pointer being
    // inside the rail's box — not on the rail element itself. The rail is
    // `pointer-events: none` so its scale headroom doesn't block the map, which
    // means wheel events over the gaps between cards were never dispatched to it
    // at all: they fell through to the map canvas and zoomed. Capturing at the
    // window runs before Mapbox's own handler, so stopping propagation there
    // covers the whole strip, cards and gaps alike.
    const railScrollRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        let target: number | null = null;
        let raf = 0;

        const step = () => {
            const el = railScrollRef.current;
            if (!el || target === null) { raf = 0; return; }
            const distance = target - el.scrollLeft;
            if (Math.abs(distance) < 0.5) {
                el.scrollLeft = target;
                raf = 0;
                return;
            }
            // Wheel ticks accumulate into a target the rail eases toward, so a
            // burst of notches reads as one glide rather than a stack of jumps.
            el.scrollLeft += distance * 0.18;
            raf = requestAnimationFrame(step);
        };

        const onWheel = (e: WheelEvent) => {
            const el = railScrollRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const inside =
                e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top  && e.clientY <= r.bottom;
            if (!inside) return;

            // Claim the event before the map sees it, whatever its axis — a
            // trackpad swipe over the rail should not zoom either.
            e.preventDefault();
            e.stopPropagation();

            if (e.deltaX !== 0) { target = null; return; }   // real horizontal intent: let the browser scroll
            if (target === null || !raf) target = el.scrollLeft;
            const max = el.scrollWidth - el.clientWidth;
            // Wheel up advances to the following cards.
            target = Math.max(0, Math.min(max, target - e.deltaY));
            if (!raf) raf = requestAnimationFrame(step);
        };

        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener('wheel', onWheel, { capture: true });
        };
    }, []);

    // ── List view ─────────────────────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div className="dark flex flex-col min-h-screen" style={{ background: BG, color: TEXT }}>
                <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14"
                    style={{ background: 'rgba(15,11,22,0.95)', borderBottom: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                    <button onClick={() => setViewMode('map')}
                        className="flex items-center justify-center rounded-full cursor-pointer"
                        style={{ width: 36, height: 36, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BDR}`, flexShrink: 0 }}>
                        <ArrowLeft size={16} style={{ color: TEXT }} />
                    </button>
                    <span className="flex-1 font-semibold text-sm truncate" style={{ color: TEXT }}>
                        {destination || 'Search results'}
                    </span>
                    {count > 0 && <span className="text-xs" style={{ color: DIM }}>{count} properties</span>}
                    <SortPill value={sortBy} onChange={setSortBy} theme={uiTone} />
                </div>
                <div className="max-w-350 mx-auto px-4 sm:px-6 py-6 w-full">
                    <HotelResults
                        hotels={listHotels as unknown as HotelResult[]}
                        loading={isLoading}
                        error={status === 'error' ? 'Search failed. Please try again.' : null}
                        destination={destination}
                        searchQs={searchQs}
                    />
                </div>
            </div>
        );
    }

    // ── Full-screen map view ──────────────────────────────────────────────────
    return (
        <div className="dark relative w-full overflow-hidden" style={{ height: '100dvh', background: BG }}>

            {/* Full-bleed: the side gutters were page background showing through,
                which read as a dark frame behind the card rail.

                The `map-gray` canvas filter is gone: it existed to lift
                `dark-v11` off near-black, and Standard's night preset is
                already a mid-tone. Re-add it here if dark still reads too deep. */}
            <div className="absolute inset-0 overflow-hidden">
                <SearchMapContainer
                    properties={sorted}
                    selectedId={selectedId}
                    onSelectId={setSelectedId}
                    hoveredId={hoveredId}
                    onHoverId={setHoveredId}
                    onViewDetails={handleViewDetails}
                    defaultCenter={mapCenter}
                    searchOverlayClassName="hidden"
                    isSearching={isLoading || isStreaming}
                    districtBbox={districtBbox}
                    districtName={districtName}
                    cityName={canonicalCity || destination}
                    onZoomChange={setMapZoom}
                    showAllProperties={showAllCityOverride}
                />
            </div>

            {/* ── Floating top bar ─────────────────────────────── */}
            {/* One continuous toolbar rather than a row of loose pills: the bar is
                the ground, every control sits on it in the lighter tone. */}
            <div
                className="absolute left-4 right-4 z-30 flex items-center gap-2"
                style={{
                    top: 16, height: 60, padding: '0 10px', borderRadius: 20,
                    background: chrome.bar,
                    border: `1px solid ${chrome.border}`,
                    boxShadow: chrome.shadow,
                }}
            >
                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
                    style={{ width: 40, height: 40, flexShrink: 0, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                    <ArrowLeft size={18} style={{ color: chrome.text }} />
                </button>

                {/* Search */}
                <SearchBar
                    summary={pillText}
                    searching={isLoading || isStreaming}
                    theme={uiTone}
                    proximity={mapCenter}
                    onSubmit={handleSearchSubmit}
                />

                {/* Theme */}
                <button
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
                    style={{ width: 40, height: 40, flexShrink: 0, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                    {theme === 'dark'
                        ? <Sun size={17} style={{ color: chrome.text }} />
                        : <Moon size={17} style={{ color: chrome.text }} />}
                </button>

                {/* List view */}
                <button
                    onClick={() => setViewMode('list')}
                    className="flex items-center gap-2 rounded-full shrink-0 cursor-pointer transition-opacity hover:opacity-80"
                    style={{ height: 40, padding: '0 16px', background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text, fontSize: 13, fontWeight: 600 }}>
                    <List size={15} />
                    List View
                </button>

                {/* Right cluster — pinned to the toolbar's far end */}
                <div className="ml-auto flex items-center gap-2">
                    {/* Count badge — shows spinner while streaming */}
                    {count > 0 && (
                        <div className="flex items-center gap-2 px-4 rounded-full shrink-0"
                            style={{ height: 40, background: chrome.surface, border: `1px solid ${chrome.border}` }}>
                            {isStreaming && (
                                <div className="animate-spin flex-shrink-0" style={{
                                    width: 11, height: 11, borderRadius: '50%',
                                    border: `1.5px solid ${chrome.border}`,
                                    borderTopColor: chrome.text,
                                }} />
                            )}
                            <span className="font-semibold whitespace-nowrap" style={{ fontSize: 13, color: chrome.text }}>
                                {isStreaming ? `${count}+` : count} stays
                            </span>
                        </div>
                    )}

                    {/* Sort */}
                    <SortPill value={sortBy} onChange={setSortBy} theme={uiTone} />
                </div>
            </div>

            {/* Looking. The skeleton rail that used to sit along the bottom is
                gone: it promised a card layout the results may not fill, and it
                competed with the badge for the eye. */}
            {isLoading && (
                <StatusScreen
                    busy
                    theme={uiTone}
                    title={`Finding Stays${destination ? ` In ${destination}` : ''}...`}
                    lines={['Searching for Availability and Prices']}
                />
            )}

            {/* Found nothing. */}
            {status === 'error' && (
                <StatusScreen
                    theme={uiTone}
                    title="No accommodations found"
                    lines={[
                        destination ? `We couldn’t find hotels in ${destination}` : 'We couldn’t find any hotels',
                        'Try adjusting your dates or destination',
                    ]}
                    action={{ label: 'Search Again', onClick: () => router.back() }}
                />
            )}

            {/* ── Bottom card rail ──────────────────────────────── */}
            <AnimatePresence>
                {sorted.length > 0 && !railHidden && (
                    <motion.div
                        initial={{ y: 160, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 160, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 170, delay: 0.05 }}
                        className="absolute left-0 right-0 bottom-0 z-20"
                        style={{ pointerEvents: 'none' }}
                    >
                        {/* List view toggle + count */}
                        <div className="flex items-center justify-between px-4 mb-0.5">
                            <div className="flex items-center gap-2">
                                {isStreaming && (
                                    <div className="animate-spin shrink-0" style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        border: '1.5px solid rgba(180,150,255,0.3)',
                                        borderTopColor: '#a78bfa',
                                    }} />
                                )}
                                <span style={{ fontSize: 11, color: isStreaming ? 'rgba(245,239,228,0.7)' : 'rgba(245,239,228,0.5)' }}>
                                    {isStreaming ? `Searching · ${count} found…` : `${count} properties`}
                                </span>
                            </div>

                            {/* Right cluster */}
                            <div className="flex items-center gap-2">
                                {/* District filter pill — shown when cards are scoped to a neighbourhood */}
                                {districtBbox && !showAllCityOverride && mapZoom >= DISTRICT_MARKER_THRESHOLD && districtName && (
                                    <button
                                        onClick={() => setShowAllCityOverride(true)}
                                        style={{
                                            background: 'rgba(255,107,75,0.15)',
                                            border: '1px solid rgba(255,107,75,0.4)',
                                            borderRadius: 100,
                                            padding: '4px 12px',
                                            fontSize: 11, fontWeight: 700,
                                            color: ACCENT, cursor: 'pointer',
                                            backdropFilter: 'blur(8px)',
                                            whiteSpace: 'nowrap',
                                            pointerEvents: 'auto',
                                        }}
                                    >
                                        {districtName} · See all in {canonicalCity || destination}
                                    </button>
                                )}

                                {/* Hide the rail. In this row rather than floating over
                                    the strip below: anywhere inside the scroller it
                                    covered a card, and no z-index fixes that — the cards
                                    still have to pass underneath it. Here it has the
                                    line to itself. */}
                                <button
                                    onClick={() => setRailHidden(true)}
                                    aria-label="Hide stay cards"
                                    title="Hide cards"
                                    className="flex items-center justify-center rounded-full shrink-0 cursor-pointer transition-opacity hover:opacity-80"
                                    style={{
                                        width: 40, height: 40,
                                        background: chrome.surface, border: `1px solid ${chrome.border}`,
                                        boxShadow: chrome.shadow,
                                        pointerEvents: 'auto',
                                    }}>
                                    <ChevronDown size={18} style={{ color: chrome.text }} />
                                </button>
                            </div>
                        </div>

                        {/* Horizontal scroll cards — wheel handler converts vertical scroll to horizontal */}
                        <div className="relative" style={{ paddingBottom: 28, paddingLeft: 24 }}>
                            <div
                                ref={railScrollRef}
                                className="flex items-end gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
                                // `overflow-x: auto` forces overflow-y to auto too, so a
                                // selected card scaling up would be clipped. The headroom
                                // gives it somewhere to grow; the whole rail is
                                // pointer-transparent so that headroom doesn't swallow
                                // clicks meant for the map.
                                style={{ overscrollBehaviorX: 'contain', paddingTop: SELECT_HEADROOM }}
                            >
                                {railCards.map(({ property, isSelected, isHovered, shiftLeft, shiftRight }) => (
                                    <RailCard
                                        key={property.id}
                                        property={property}
                                        isSelected={isSelected}
                                        isHovered={isHovered}
                                        shiftLeft={shiftLeft}
                                        shiftRight={shiftRight}
                                        onSelect={handleSelect}
                                        onHover={setHoveredId}
                                        onViewDetails={handleViewDetails}
                                        currency={currency}
                                        theme={uiTone}
                                    />
                                ))}
                                {/* Mirrors the strip's left inset so the last card
                                    doesn't butt against the window edge */}
                                <div style={{ minWidth: 24, flexShrink: 0 }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bring the rail back */}
            <AnimatePresence>
                {sorted.length > 0 && railHidden && (
                    <motion.button
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
                        onClick={() => setRailHidden(false)}
                        className="absolute z-20 flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                        style={{
                            right: 16, bottom: 28,
                            background: chrome.surface, border: `1px solid ${chrome.border}`,
                            borderRadius: 100, padding: '9px 15px',
                            fontSize: 12, fontWeight: 700, color: chrome.text,
                            boxShadow: chrome.shadow,
                        }}>
                        <ChevronUp size={14} />
                        Show {count} stays
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HotelSearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center" style={{ height: '100dvh', background: BG }}>
                    <div className="rounded-full border-2 border-t-transparent animate-spin"
                        style={{ width: 32, height: 32, borderColor: ACCENT, borderTopColor: 'transparent' }} />
                </div>
            }
        >
            <HotelSearchContent />
        </Suspense>
    );
}
