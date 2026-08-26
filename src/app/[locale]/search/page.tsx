'use client';

import React, { useEffect, useRef, useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { MappableProperty, ApiHotel } from '@/shared/components/map/types';
import { HotelResults } from '@/features/hotels/components/hotel-results';
import { HotelFilters, type HotelFiltersState } from '@/features/hotels/components/hotel-filters';
import type { HotelResult } from '@/features/hotels/components/hotel-card';
import { env } from '@/shared/lib/env';
import { useUserCurrency } from '@/stores/searchStore';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/shared/components/ThemeContext';
import { useDeclareChromeTone } from '@/shared/components/ChromeToneContext';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import { cn } from '@/shared/lib/cn';
import { SHELL_CAP, SHELL_GUTTER } from '@/shared/lib/layout';
import { SearchTopBar } from '@/features/search/components/search-top-bar';
import { ACCENT, SORT_OPTIONS, sortPalette, type SortValue } from '@/features/search/components/search-chrome';


const DISTRICT_MARKER_THRESHOLD = 11;

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG            = '#15111E';
/**
 * The list view's ground — neutral, not the map view's plum, and a step below
 * the card surface so the cards read as plates rather than as the page.
 */
const LIST_BG       = { dark: '#141414', light: '#F1F1F4' };

/**
 * Nothing filtered, for either view's panel.
 *
 * `±Infinity` means "not set": the price bounds are only known once results
 * have streamed, and a concrete 0 would read as a deliberate filter the moment
 * the cheapest stay costs more than nothing.
 */
const EMPTY_FILTERS: HotelFiltersState = {
    sortBy: 'recommended', starRatings: [], minPrice: -Infinity, maxPrice: Infinity,
};


const SearchMapContainer = dynamic(
    () => import('@/shared/components/mapbox/SearchMapContainer').then(m => m.SearchMapContainer),
    { ssr: false, loading: () => <div className="w-full h-full" style={{ background: '#1B2A2E' }} /> }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
type ViewMode = 'map' | 'list';

/**
 * A `prices` chunk off the search stream: the rate for one hotel, arriving
 * after the hotel itself did. Only the three fields the merge below reads.
 */
interface PriceUpdate {
    hotelId: string;
    price?: number;
    currency?: string;
}

/** A row from `/hotels/destinations`, narrowed by the caller to the `city` kind. */
interface SuggestDestination {
    type?: string;
    lat?: number;
    lng?: number;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────
function toMappable(h: ApiHotel): MappableProperty | null {
    const lat = h.lat ?? h.latitude ?? h.coordinates?.lat;
    const lng = h.lng ?? h.longitude ?? h.coordinates?.lng;
    if (!lat || !lng) return null;
    return {
        id: (h.id ?? h.hotelId) as string,
        name: h.name as string,
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
// The design's landscape plate: the photo fills the left edge over the card's
// full height, the name and address stack against it, and the baseline carries
// the price/rating pair against the View Stay pill on the right.
//
// Geometry is scaled from the design's 340px artboard, so CARD_W is the single
// number to tune — every other measure follows it through `px` / `fpx`.

const CARD_W = 340;
const CARD_REF_W = 340;
const SCALE = CARD_W / CARD_REF_W;
/** Geometry: whole pixels. */
const px = (n: number) => Math.round(n * SCALE);
/**
 * Type does not follow the geometry all the way down. Scaled linearly, a
 * narrow card puts the title at 8px and the price at 6px — proportionally
 * right and unreadable. The floor keeps text legible while the card is free to
 * shrink; at or above the artboard width the floor stops binding and type is
 * proportional again.
 */
const TYPE_SCALE = Math.max(SCALE, 0.9);
const fpx = (n: number) => Math.round(n * TYPE_SCALE * 10) / 10;

/**
 * The rail's inset, as a number, for the one thing that needs it as one: the
 * phone card's own width.
 *
 * Everywhere else the rail sits in `SHELL_GUTTER` / `SHELL_CAP` — the toolbar's
 * box — so the strip begins under the bar's left edge and ends under its right
 * one at every width. It used to be measured on its own, in JS, off an
 * `isMobile` that flips at 768 where the shell's gutter steps at 640; between
 * those two widths the first card started 8px inside the tally chip above it,
 * and past 1448 the whole strip sat a couple of hundred pixels left of the bar.
 *
 * The cap costs the strip nothing it was using: it still runs off its box's
 * right edge, so the card after the last visible one still shows and the strip
 * still reads as something to swipe — that edge is now the bar's rather than
 * the window's.
 */
const RAIL_GUTTER_MOBILE = 20;
const RAIL_GUTTER        = 24;

/**
 * The card's box, at the two sizes it is drawn.
 *
 * `minH` is a floor, not the height: type is held at TYPE_SCALE while the
 * geometry runs at SCALE, so the panel routinely outgrows it. Anything that
 * has to match the card's *rendered* height measures it — see `railCardH` —
 * and takes this only as the starting estimate.
 */
const CARD_GEOM = {
    /** The photo column — the design's left third, full-bleed top to bottom. */
    imgW:  px(104),
    padX:  px(14),
    padY:  px(12),
    minH:  px(112),
    width: `${CARD_W}px`,
    /** The View Stay pill's own padding. */
    pillX: px(18),
    pillFs: fpx(12),
    priceFs: fpx(13),
    pillLabel: 'View Stay',
};
/**
 * The phone's card is the same plate, drawn tighter: a narrower box, a
 * narrower photo, and less air around the type. It stops short of the window
 * on both sides, so the card after it shows at the edge and the strip reads as
 * something to swipe rather than as a single fixed panel.
 *
 * The photo gives up proportionally more than the panel does. The panel's
 * baseline row is what actually constrains this card — a price and a pill on
 * one line — so shrinking both columns evenly would have run the two into each
 * other long before the card got narrow.
 */
const CARD_W_MOBILE = 258;
const CARD_GEOM_MOBILE = {
    imgW:  px(74),
    padX:  px(11),
    padY:  px(9),
    minH:  px(96),
    width: `min(${CARD_W_MOBILE}px, calc(100vw - ${RAIL_GUTTER_MOBILE * 2}px))`,
    pillX: px(12),
    pillFs: fpx(11.5),
    priceFs: fpx(12.5),
    /**
     * "View Stay" no longer clears a long price on one line here — a peso
     * amount runs to thirteen characters — and the price is the half that
     * cannot be abbreviated. The card is the tap target either way, so the
     * pill is only a visible affordance for it and reads fine shortened.
     */
    pillLabel: 'View',
};
/**
 * Room the rail leaves under itself for the app's bottom nav.
 *
 * The nav is `lg:hidden` and stands 80px over the safe area — a 70px bar plus
 * its own 10px inset — so the rail clears it at every width below `lg`, not
 * just below `md` where the phone layout starts. Sitting on the same
 * breakpoint the nav uses is the only thing that keeps a tablet's cards out
 * from under it.
 */
/**
 * The map view's floating chrome sits on the bottom nav's box, not the shell's.
 *
 * `SHELL_GUTTER` opens at 20px and the nav's own fixed wrapper at 16px, so on a
 * phone the toolbar floated 4px inside the nav below it and the two pills — the
 * only two things on the screen with a hard left and right edge — did not line
 * up. The nav is the one that cannot move: it is every screen's, while this
 * gutter is this view's alone.
 *
 * Only the first step changes. Past `sm` the shell's own 32/48 take over again,
 * which is where the nav stops being the thing the eye compares against — it
 * still carries its 16px to `lg`, so between those two widths the bar is wider
 * than the nav rather than narrower. If that reads wrong on a tablet, the fix
 * is `px-4 lg:px-12` here, and it is a design call rather than a bug.
 */
const MAP_CHROME_GUTTER = 'px-4 sm:px-8 lg:px-12';

const RAIL_PAD_B_MOBILE = 'pb-[calc(env(safe-area-inset-bottom,0px)+104px)] lg:pb-7';
/** The same clearance as an offset, for anything that floats rather than pads. */
const RAIL_BOTTOM_MOBILE = 'bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] lg:bottom-7';
/** How much a selected card grows. */
const SELECT_SCALE = 1.08;
/** Half the horizontal growth — applied as margin either side of the selected
 *  card so its neighbours slide out of the way instead of being covered.
 *  `transform` alone paints over them without moving them. */
const SELECT_GUTTER = Math.round((CARD_W * (SELECT_SCALE - 1)) / 2);

/** The strip's `gap-3`, as a number, for the page arithmetic below. */
const RAIL_GAP = 12;

/**
 * The most cards the strip shows at once — and so, the most it steps by.
 *
 * A page is a screenful: the cards are sized so exactly this many fill the
 * strip's width, and an arrow steps by exactly that many. Nothing is ever half
 * on screen, at rest or after a step, which is the whole point — a card sliced
 * by the container's edge reads as a card running off the strip rather than as
 * the end of it.
 *
 * A cap rather than a fixed count: five 250px cards need 1300px of strip, which
 * a laptop has and a phone does not. Below that the count drops rather than the
 * cards being cut — see `railPerView`.
 */
const RAIL_PAGE_SIZE = 5;

/**
 * The narrowest a card may be squeezed to before the strip shows one fewer
 * instead.
 *
 * Sets where each step down happens. At the shell's 1400px cap it lands just
 * inside five, so a full-width desktop gets the five the design asks for at
 * ~264px each — narrower than the 340px artboard, which the type scale's floor
 * already covers.
 */
const RAIL_MIN_CARD_W = 250;

/**
 * Room the scroller keeps at both ends, outside the cards.
 *
 * Two things were cut off without it. A selected card wears `scale(1.08)`, and
 * `overflow-x: auto` clips it — at the ends there is no neighbour to grow into,
 * so the first and last cards lost their outer edge whenever they were the one
 * picked. And at full scroll the last card sat flush against the box, which
 * read as a card running off the strip rather than as the end of it.
 *
 * Spent as negative margin plus equal padding: the box grows outward by this
 * much on each side, while the content starts exactly where it did. The strip's
 * left edge still lines up under the toolbar's.
 */
const RAIL_EDGE_PAD = SELECT_GUTTER;

/**
 * How long one wheel gesture owns the rail.
 *
 * A wheel gesture is a burst of notches, not one event; without a floor between
 * steps a single flick would run through every page it had. Long enough to
 * swallow the burst, short enough that a deliberate second flick still lands.
 */
const RAIL_WHEEL_PAGE_MS = 320;

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
    onSelect, onHover, onViewDetails, currency, nights, theme, mobile, elementRef, width,
}: {
    property: MappableProperty; isSelected: boolean; isHovered: boolean;
    /** Room a grown neighbour needs on this card's left / right. */
    shiftLeft: number; shiftRight: number;
    onSelect: (id: string) => void; onHover: (id: string | null) => void;
    onViewDetails: (id: string) => void;
    currency: string; nights: number; theme: 'light' | 'dark';
    /** One card to a screen, edge to edge — the design's phone layout. */
    mobile: boolean;
    /** Hands the card's element up so the rail can scroll it into view when its
     *  pin is clicked. */
    elementRef?: (el: HTMLDivElement | null) => void;
    /**
     * The exact width to draw at, in px, from the rail's own division of its
     * strip. Falls back to the geometry's own width until the strip has been
     * measured — one frame, on mount.
     */
    width?: number;
}) {
    const c = railCardPalette(theme);
    const price = convertCurrency(property.price, property.currency || 'USD', currency) / nights;
    const priceStr = formatCurrency(price, currency);
    const rating = property.rating ?? 0;
    /**
     * Selection grows the card at every width — it is how a pin click shows
     * which of the cards it landed on, and the phone's card is no longer wide
     * enough for growing it to push its edges under the window's.
     *
     * Hover only counts where there is a real pointer. A tap fires
     * `mouseenter` on most touch browsers and never fires `mouseleave`, so on a
     * phone the hover state sticks and would leave a card grown after it had
     * been deselected.
     */
    const enlarged = isSelected || (!mobile && isHovered);
    const address = property.location ?? property.city ?? '';
    const g = mobile ? CARD_GEOM_MOBILE : CARD_GEOM;

    return (
        <div
            ref={elementRef}
            onClick={() => onSelect(property.id)}
            onMouseEnter={() => onHover(property.id)}
            onMouseLeave={() => onHover(null)}
            className="shrink-0 cursor-pointer"
            style={{
                position: 'relative',
                width: width ? `${width}px` : g.width, minHeight: g.minH,
                borderRadius: px(16), overflow: 'hidden',
                display: 'flex', alignItems: 'stretch',
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
                marginLeft: mobile ? 0 : shiftLeft,
                marginRight: mobile ? 0 : shiftRight,
                zIndex: isSelected ? 5 : isHovered ? 4 : 1,
                transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), margin 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                // The rail is pointer-transparent so its scale headroom doesn't
                // block the map; the cards themselves opt back in.
                pointerEvents: 'auto',
            }}
        >
            {/* Photo — the card's left edge, cropped by the card's own radius. */}
            <div style={{ width: g.imgW, flexShrink: 0, position: 'relative', background: c.imageBg }}>
                {property.image ? (
                    <Image src={property.image} alt={property.name} fill className="object-cover" sizes="140px" />
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

            {/* Panel */}
            <div style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                padding: `${g.padY}px ${g.padX}px`, background: c.surface,
            }}>
                <h3 style={{
                    fontSize: fpx(14), fontWeight: 700, color: c.title, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {property.name}
                </h3>
                {/* The address and the rating always render, falling back to a
                    non-breaking space. Rendered conditionally they collapsed, so
                    a hotel missing either one came out shorter than its
                    neighbours and the rail's baseline went ragged. */}
                <p style={{
                    fontSize: fpx(11), color: c.muted, marginTop: px(3), lineHeight: 1.35,
                    // Two lines of address, as drawn — clamped rather than cut on
                    // one line so a street address still reads.
                    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                    overflow: 'hidden',
                    // Holds the two-line box open when the clamp has one line, or
                    // none, to work with.
                    minHeight: fpx(11) * 1.35 * 2,
                }}>
                    {address || ' '}
                </p>
                {/* Baseline: the price over the rating, the pill opposite. */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: px(10),
                    marginTop: 'auto', paddingTop: px(8),
                }}>
                    {/* Price / rating stack */}
                    <div style={{ minWidth: 0 }}>
                        {property.priceLoading ? (
                            <div className="animate-pulse rounded-full" style={{ width: px(76), height: fpx(13), background: 'rgba(128,128,128,0.35)' }} />
                        ) : (
                            <p style={{
                                fontSize: g.priceFs, fontWeight: 700, color: c.title, lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {`${priceStr}/night`}
                            </p>
                        )}
                        <p style={{ fontSize: fpx(11), color: c.muted, marginTop: px(2), lineHeight: 1.35 }}>
                            {rating > 0 ? `${rating.toFixed(1)} rating` : ' '}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(property.id); }}
                        style={{
                            marginLeft: 'auto', flexShrink: 0,
                            background: c.chipBg, color: c.chipText, border: 'none',
                            borderRadius: 100, padding: `${px(9)}px ${g.pillX}px`,
                            fontSize: g.pillFs, fontWeight: 600, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}>
                        {g.pillLabel}
                    </button>
                </div>
            </div>
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

    const nights = useMemo(() => {
        const ci = new Date(checkIn);
        const co = new Date(checkOut);
        if (isNaN(ci.getTime()) || isNaN(co.getTime())) return 1;
        const n = Math.round((co.getTime() - ci.getTime()) / 86_400_000);
        return n > 0 ? n : 1;
    }, [checkIn, checkOut]);

    const [hotels, setHotels]                   = useState<MappableProperty[]>([]);
    const [status, setStatus]                   = useState<StreamStatus>('idle');
    const [viewMode, setViewMode]               = useState<ViewMode>('map');
    const [sortBy, setSortBy]                   = useState<SortValue>('recommended');
    const [selectedId, setSelectedId]           = useState<string | null>(null);
    const [hoveredId, setHoveredId]             = useState<string | null>(null);
    const [mapZoom, setMapZoom]                 = useState(12);
    const [showAllCityOverride, setShowAllCityOverride] = useState(false);
    /** The toolbar's nearby-places toggle. On by default, as the map has always
     *  behaved; the button only gives that behaviour a way off. */
    const [showPois, setShowPois]               = useState(true);
    const [filtersOpen, setFiltersOpen]         = useState(false);
    /**
     * The list view's own toolbar panel, and the filters behind it.
     *
     * The values are lifted out of `HotelResults` so the panel hanging off the
     * toolbar and the sidebar inside the results can be the same filters seen
     * twice rather than two that disagree. Below `lg` the dropdown is the only
     * one of the two on screen; above it, the sidebar.
     *
     * Separate from `mapFilters` below on purpose: the two views filter
     * different sets — the map's is district-scoped — and are never on screen
     * together, so nothing is gained by sharing one state and a stale filter
     * carried across the toggle would be worse than none.
     */
    const [listFiltersOpen, setListFiltersOpen] = useState(false);
    const [listFilters, setListFilters] = useState<HotelFiltersState>(EMPTY_FILTERS);
    /**
     * The map view's own filter panel state.
     *
     * `sortBy` is carried but never read: the panel's Sort By section is handed
     * the toolbar's own list and `sortBy` state through its `sort` prop, so the
     * pill and the panel set one value between them. This field stays in the
     * shape only so the panel can take `HotelFiltersState` whole.
     */
    const [mapFilters, setMapFilters] = useState<HotelFiltersState>(EMPTY_FILTERS);
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
    /**
     * Only the card rail asks in JS — its width is a value, not a class. The
     * rest of the phone layout is plain `md:` breakpoints, which are already
     * right on the first paint; this flips a frame after mount, and the rail
     * has no cards to draw until a search comes back anyway.
     */
    const isMobile   = useIsMobile();
    const { theme, toggleTheme } = useTheme();
    /**
     * The chrome floating over the map follows the app theme: dark mode gets
     * black controls and black cards over the night basemap, light mode white
     * ones over the day basemap.
     *
     * It used to run *opposite* the theme, on the reasoning that chrome should
     * contrast the basemap rather than match it. That held the bar apart from
     * the map, but it also meant turning the app dark turned this screen's
     * controls white — the one screen in the app where dark mode did not go
     * dark. Matching the theme is what people expect a theme to do; the map's
     * own night preset is a mid-tone, so black chrome still reads as sitting on
     * top of it rather than dissolving into it.
     *
     * Kept as its own name rather than folded into `theme` because everything
     * over the map reads it — the bar, the rail cards, the filter panel, the
     * bottom nav — and one name is what keeps them agreeing.
     */
    const uiTone     = theme;
    /** One surface for every control floating over the map. */
    const chrome     = sortPalette(uiTone);
    /**
     * The app's bottom nav overlaps the map, so it inverts with the rest of the
     * chrome here — otherwise it lands as a white slab under a row of dark
     * cards. The list view has no basemap to contrast, so it claims nothing and
     * the nav falls back to the theme like everywhere else.
     */
    useDeclareChromeTone(viewMode === 'map' ? uiTone : 'theme');
    /**
     * The map view is one viewport tall and fills it, so it takes the app shell
     * out of the way: no page grid showing through at the edges, no 100vh floor
     * taller than the map, and none of the shell's bottom nav inset. The list
     * view scrolls and needs all three, so it opts out. See `.map-immersive`.
     */
    useEffect(() => {
        if (viewMode !== 'map') return;
        document.body.classList.add('map-immersive');
        return () => document.body.classList.remove('map-immersive');
    }, [viewMode]);
    const searchKey  =`${destination}|${checkIn}|${checkOut}|${adults}|${children}|${rooms}|${lat}|${lng}`;

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
            const body: Record<string, string | number> = {
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
                        const list: ApiHotel[] = Array.isArray(chunk.data) ? chunk.data : Array.isArray(chunk.hotels) ? chunk.hotels : [];
                        if ((chunk.type === 'instant' || chunk.type === 'hotels') && list.length > 0) {
                            accumulated += list.length;
                            const mapped = list.map(toMappable).filter((h): h is MappableProperty => !!h && isNearby(h));
                            if (!cancelled) { setHotels(prev => { const m = new Map(prev.map(h => [h.id, h])); for (const h of mapped) m.set(h.id, h); return Array.from(m.values()); }); setStatus('streaming'); }
                        } else if (chunk.type === 'prices' && Array.isArray(chunk.data)) {
                            const pm = new Map<string, PriceUpdate>(
                                (chunk.data as PriceUpdate[]).map((p) => [p.hotelId, p]),
                            );
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
    // /hotels/destinations, not the older /hotels/suggest: same Mapbox coords, but
    // resolved through the city-alias dictionary and ranked by whether we actually
    // stock the place, so "gangnam" lands on Seoul.
    useEffect(() => {
        setGeocodedCoords(null);
        if (lat && lng) return;
        if (!destination) return;
        const apiBase = env.NEXT_PUBLIC_API_URL;
        if (!apiBase) return;
        let cancelled = false;
        fetch(`${apiBase}/hotels/destinations?query=${encodeURIComponent(destination)}`)
            .then(r => r.json())
            .then((data: { data?: SuggestDestination[] }) => {
                if (cancelled) return;
                // A type predicate, not a plain boolean: `find` carries the
                // narrowing out to `city` only if the callback declares it, and
                // the two `typeof` checks are what make it true.
                const city = (data?.data ?? []).find(
                    (d): d is SuggestDestination & { lat: number; lng: number } =>
                        d.type === 'city' && typeof d.lat === 'number' && typeof d.lng === 'number'
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
    //
    // Off `sorted` rather than `mapFiltered`: the list view has a filter panel of
    // its own, and stacking the two would filter the list by criteria its panel
    // does not show — each side would then explain only half of why a hotel is
    // missing.
    const listHotels = useMemo(() =>
        sorted.map(h => ({
            ...h,
            price: Math.round(convertCurrency(h.price, h.currency || 'USD', currency) / nights),
            currency,
        })),
    [sorted, currency, nights]);

    /**
     * Price bounds for the filter panel's slider, in the user's own currency —
     * the same figures the cards show, so dragging the handle to a number means
     * what it looks like it means.
     */
    const priceRange = useMemo(() => {
        const prices = sorted
            .filter(h => !h.priceLoading)
            .map(h => convertCurrency(h.price, h.currency || 'USD', currency) / nights)
            .filter(p => p > 0);
        if (prices.length === 0) return { min: 0, max: 1000 };
        const min = Math.floor(Math.min(...prices));
        const max = Math.ceil(Math.max(...prices));
        // A single price point would give the slider a zero-width track.
        return { min, max: max > min ? max : min + 1 };
    }, [sorted, currency, nights]);

    /**
     * The panel's bounds, clamped to the range. Unset bounds fall back to it,
     * and set ones are clipped, since the range keeps widening while prices
     * stream in behind the user's back.
     */
    const clampToRange = (f: HotelFiltersState) => {
        const min = Number.isFinite(f.minPrice) ? Math.max(f.minPrice, priceRange.min) : priceRange.min;
        const max = Number.isFinite(f.maxPrice) ? Math.min(f.maxPrice, priceRange.max) : priceRange.max;
        return { min, max, narrowed: min > priceRange.min || max < priceRange.max };
    };

    const listBounds = clampToRange(listFilters);
    /** The list toolbar button's dot, counted the same way the map's is. */
    const listActiveFilterCount = listFilters.starRatings.length + (listBounds.narrowed ? 1 : 0);

    const filterMin = Number.isFinite(mapFilters.minPrice) ? Math.max(mapFilters.minPrice, priceRange.min) : priceRange.min;
    const filterMax = Number.isFinite(mapFilters.maxPrice) ? Math.min(mapFilters.maxPrice, priceRange.max) : priceRange.max;
    const priceNarrowed = filterMin > priceRange.min || filterMax < priceRange.max;
    /** What the toolbar button's dot is counting. */
    const activeFilterCount = mapFilters.starRatings.length + (priceNarrowed ? 1 : 0);

    /**
     * `sorted` with the toolbar's filter panel applied — the list the map draws
     * pins for and the rail draws cards for, so the two always agree.
     */
    const mapFiltered = useMemo(() => {
        let list = sorted;
        if (mapFilters.starRatings.length > 0) {
            list = list.filter(h =>
                h.starRating !== undefined && mapFilters.starRatings.includes(Math.round(h.starRating)),
            );
        }
        if (priceNarrowed) {
            // A stay whose price has not landed yet is kept: it has no figure to
            // judge, and dropping it would have pins blinking off the map as the
            // price stream catches up.
            list = list.filter(h => {
                if (h.priceLoading) return true;
                const p = convertCurrency(h.price, h.currency || 'USD', currency) / nights;
                return p >= filterMin && p <= filterMax;
            });
        }
        return list;
    }, [sorted, mapFilters.starRatings, priceNarrowed, filterMin, filterMax, currency, nights]);

    const railSorted = useMemo(() => {
        if (!districtBbox || showAllCityOverride || mapZoom < DISTRICT_MARKER_THRESHOLD) return mapFiltered;
        const [minLng, minLat, maxLng, maxLat] = districtBbox;
        return mapFiltered.filter(p =>
            p.coordinates.lng >= minLng && p.coordinates.lng <= maxLng &&
            p.coordinates.lat >= minLat && p.coordinates.lat <= maxLat
        );
    }, [mapFiltered, districtBbox, showAllCityOverride, mapZoom]);
    const count   = railSorted.length;

    /**
     * A grown card — selected or hovered — spreads half its extra width to each
     * side. That room is taken by its neighbours rather than by the card itself,
     * so the grown card never moves under the cursor.
     */
    const railCards = useMemo(() => {
        const shown = railSorted.slice(0, 50);
        /**
         * The strip always holds the selected stay, even when its own window
         * does not reach it.
         *
         * The map draws every hotel in `sorted`; the rail draws the first 50 of
         * a district-scoped subset. So a pin can be clicked for a stay the strip
         * has no card for — past the window, or outside the district — and
         * without this the click would select a hotel the rail could neither
         * scroll to nor grow. Appended rather than slotted in: its real position
         * is somewhere past the end anyway.
         */
        if (selectedId && !shown.some(p => p.id === selectedId)) {
            const picked = mapFiltered.find(p => p.id === selectedId);
            if (picked) shown.push(picked);
        }
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
    }, [railSorted, mapFiltered, selectedId, hoveredId]);
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

    /**
     * Headroom for a grown card, measured rather than derived.
     *
     * The scroller is `overflow-x: auto`, which forces `overflow-y: auto` with
     * it, so anything a card gains from `scale()` is clipped unless the padding
     * above it already covers the growth. Computing that padding from
     * the geometry's own floor under-reserved it — the panel outgrows it —
     * and the top of a hovered card was cropped. Every card renders the same
     * rows, so measuring one is enough for all of them, and it stays right if
     * the type or the padding ever moves.
     */
    const [railCardH, setRailCardH] = useState(CARD_GEOM.minH);
    const railHeadroom = Math.ceil(railCardH * (SELECT_SCALE - 1));

    /**
     * The strip's own inner width — what the cards have to divide between them.
     *
     * Measured rather than derived from the breakpoint: the strip sits inside
     * the shell's gutter *and* its cap, so its width is a function of both, and
     * the cap only starts binding past ~1500px. Watched rather than read once,
     * so a rotated phone or a dragged window re-divides the cards.
     */
    const [railViewW, setRailViewW] = useState(0);

    /**
     * Bumped by `attachRailScroll` on every genuine attach — the one signal
     * the height effect below can trust to mean "the scroller (and its first
     * card) now exist," whatever produced that attach.
     */
    const [railScrollEpoch, setRailScrollEpoch] = useState(0);
    const railWidthObserverRef = useRef<ResizeObserver | null>(null);

    /**
     * Attaches (and re-attaches) the width observer directly off the DOM
     * node's own lifecycle, via a callback ref, rather than off a piece of
     * state used as a proxy for "has it (re)mounted yet."
     *
     * That distinction used to not matter, back when a map↔list switch was a
     * synchronous swap: `railHidden`/`viewMode` changing and the new node
     * appearing landed in the same tick, so keying an effect off them worked
     * by coincidence. It stopped holding the moment the switch became
     * animated (`AnimatePresence` in the view-switch above): `viewMode`
     * flips instantly, but the new element doesn't exist until the outgoing
     * view's exit animation finishes — the effect fired immediately, found
     * nothing, and had no second trigger once the node actually arrived, since
     * its dependency had already changed and wouldn't change again. A
     * callback ref sidesteps the whole class of bug: React calls it with the
     * element exactly when it's really there, and with `null` exactly when
     * it's really gone, independent of whatever animation or delay produced
     * that transition.
     */
    const attachRailScroll = useCallback((el: HTMLDivElement | null) => {
        railScrollRef.current = el;
        railWidthObserverRef.current?.disconnect();
        railWidthObserverRef.current = null;
        if (!el) return;

        const measure = () => setRailViewW(el.clientWidth - RAIL_EDGE_PAD * 2);
        measure();
        railWidthObserverRef.current = new ResizeObserver(measure);
        railWidthObserverRef.current.observe(el);

        // Lets the height effect below (re)grab the first card now that the
        // scroller genuinely exists, without giving it a reason to fire on
        // every unrelated re-render.
        setRailScrollEpoch(e => e + 1);
    }, []);

    // The first card's height, kept live for two different reasons: the
    // scroller itself (re)appearing (`railScrollEpoch`, from the callback ref
    // above), and the *same* scroller's first card changing identity as the
    // result set is re-sorted or refiltered (`sorted.length`) — a case the
    // callback ref can't see, since the scroller doesn't remount for it.
    useEffect(() => {
        const card = railScrollRef.current?.firstElementChild as HTMLElement | null;
        if (!card) return;
        // offsetHeight is the layout box, so a card mid-hover reports its
        // resting height rather than its scaled one.
        const measure = () => setRailCardH(card.offsetHeight || CARD_GEOM.minH);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(card);
        return () => ro.disconnect();
    }, [sorted.length, railScrollEpoch]);

    /**
     * How many cards are on screen, and how wide each one is drawn.
     *
     * The division is the fix for cards being sliced by the container: rather
     * than laying fixed-width cards down until the strip runs out mid-card, the
     * strip decides how many whole cards it can hold at a sane size and gives
     * each an exact share of what it has. `RAIL_PAGE_SIZE` caps the count and
     * `RAIL_MIN_CARD_W` sets where it steps down.
     *
     * Both fall back to the geometry's own width for the one frame before the
     * strip has been measured.
     */
    const railPerView = railViewW > 0
        ? Math.max(1, Math.min(RAIL_PAGE_SIZE, Math.floor((railViewW + RAIL_GAP) / (RAIL_MIN_CARD_W + RAIL_GAP))))
        : 1;
    const railCardW = railViewW > 0
        ? Math.floor((railViewW - (railPerView - 1) * RAIL_GAP) / railPerView)
        : 0;

    /**
     * The strip's pages. One page is one screenful, so a step lands with whole
     * cards filling the strip and nothing half-shown at either edge.
     */
    const railPageW     = (railCardW + RAIL_GAP) * railPerView;
    const railPageCount = Math.max(1, Math.ceil(railCards.length / railPerView));
    const [railPage, setRailPage] = useState(0);

    /**
     * How long the counter ignores what the scroller says.
     *
     * A page step sets the counter and then animates toward it, and a smooth
     * scroll fires `scroll` the whole way. Without this the reader below would
     * round every intermediate position back to the page being left, and the
     * counter would tick backwards for a few frames before landing.
     */
    const railPagingUntil = useRef(0);

    const goToRailPage = useCallback((page: number) => {
        const el = railScrollRef.current;
        if (!el) return;
        const clamped = Math.max(0, Math.min(railPageCount - 1, page));
        // The last page is short of a full stride whenever the card count is
        // not a multiple of the page size, so the travel is clamped to what the
        // scroller actually has left rather than to the page's own offset.
        const max = Math.max(0, el.scrollWidth - el.clientWidth);
        railPagingUntil.current = performance.now() + 600;
        el.scrollTo({ left: Math.min(clamped * railPageW, max), behavior: 'smooth' });
        setRailPage(clamped);
    }, [railPageCount, railPageW]);

    /**
     * Keeps the counter honest when the strip is moved by something other than
     * a page step — a swipe, a drag, or the scroll that centres the card behind
     * a clicked pin.
     */
    const handleRailScroll = useCallback(() => {
        const el = railScrollRef.current;
        if (!el || railPageW <= 0) return;
        if (performance.now() < railPagingUntil.current) return;
        const page = Math.round(el.scrollLeft / railPageW);
        setRailPage(Math.max(0, Math.min(railPageCount - 1, page)));
    }, [railPageCount, railPageW]);

    // A narrowed filter or a new search can leave the counter past the end.
    useEffect(() => {
        setRailPage(p => Math.min(p, railPageCount - 1));
    }, [railPageCount]);

    /**
     * The cards, by hotel id, so a selection can find its own.
     *
     * A ref map rather than a `[data-id]` query: hotel ids come from the
     * supplier and are not guaranteed to be safe inside a CSS selector.
     */
    const railCardEls = useRef(new Map<string, HTMLDivElement>());

    /**
     * Clicking a pin selects a hotel; the rail then brings that hotel's card to
     * the middle, so the map and the strip never disagree about which stay is
     * being looked at. The card grows on its own — see `enlarged` in RailCard —
     * this is only the travel.
     *
     * A hidden rail is opened first. The scroll cannot run in the same pass,
     * because the cards do not exist yet; the effect re-runs on `railHidden` and
     * finds them on the way back through.
     *
     * `offsetLeft` rather than a bounding rect: the selected card is already
     * wearing its `scale()` by the time this runs, and a rect would report the
     * grown box — centring on it would sit a few percent of the card's width off.
     * Layout offsets ignore transforms. They also ignore the neighbours' margin
     * transition, which is still animating here, so on desktop the landing can be
     * up to a gutter out until that settles.
     */
    useEffect(() => {
        if (!selectedId) return;
        if (railHidden) { setRailHidden(false); return; }

        const scroller = railScrollRef.current;
        const card = railCardEls.current.get(selectedId);
        if (!scroller || !card) return;

        const left = card.offsetLeft - scroller.offsetLeft
            - (scroller.clientWidth - card.offsetWidth) / 2;
        scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }, [selectedId, railHidden]);

    /**
     * The page step, and where it is, read by the wheel listener below.
     *
     * That listener is registered once — it is a capturing window listener, and
     * re-registering it on every page change would be a teardown per step — so
     * it cannot close over either value directly.
     */
    const goToRailPageRef = useRef(goToRailPage);
    const railPageRef     = useRef(railPage);
    useEffect(() => {
        goToRailPageRef.current = goToRailPage;
        railPageRef.current     = railPage;
    });

    useEffect(() => {
        let lastStep = 0;

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

            // Wheel up advances to the following cards, as it always has; a
            // trackpad's horizontal axis reads the way the page does, where a
            // positive delta moves further in.
            const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? -e.deltaY : e.deltaX;
            if (Math.abs(delta) < 1) return;

            const now = performance.now();
            if (now - lastStep < RAIL_WHEEL_PAGE_MS) return;
            lastStep = now;

            goToRailPageRef.current(railPageRef.current + (delta > 0 ? 1 : -1));
        };

        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
        return () => window.removeEventListener('wheel', onWheel, { capture: true });
    }, []);

    // ── View switch ───────────────────────────────────────────────────────────
    // One return rather than the early-return-per-view this used to be:
    // `AnimatePresence` needs both sides of a swap as siblings under a parent
    // that never itself unmounts, so it can hold the outgoing view mounted
    // for its exit before the incoming one appears. `mode="wait"` sequences
    // that exit-then-enter rather than overlapping them — list is normal
    // document flow and map is a fixed `100dvh` shell, and cross-fading them
    // concurrently would fight over the viewport rather than hand off cleanly.
    return (
        <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
            <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className={theme === 'dark' ? 'dark flex flex-col min-h-screen' : 'flex flex-col min-h-screen'}
                style={{ background: LIST_BG[theme], color: theme === 'dark' ? '#F5F5F5' : '#111111' }}
            >
                {/* The map view's toolbar, the same component at the same
                    sizes. Sort is the one control that stays behind — the
                    filter panel owns it here, and two of them would disagree —
                    and filters and nearby places go with it, the first because
                    the panel below is already the list's filter surface, the
                    second because there are no map discs to draw.

                    The bar takes the card surface rather than the map's own
                    `bar` tone, so in either theme it is the same plate as the
                    cards and the filter panel below it.

                    The tally is not up here either: the map keeps it in the
                    corner of its card rail, and this view prints it under the
                    results heading.

                    The bar floats on the page ground rather than spanning the
                    window, so the sticky wrapper paints that ground; a
                    transparent one would let cards scroll through the inset. */}
                <div className={cn('sticky top-0 z-30 pt-4 pb-3', SHELL_GUTTER)} style={{ background: LIST_BG[theme] }}>
                    {/* The panel hangs off the bar, so the two share a box: the
                        cap is on this wrapper rather than the bar itself, and
                        the dropdown measures its offset from the bar's own
                        height instead of a hardcoded number. The map view now
                        holds its bar the same way. */}
                    <div className={cn('relative', SHELL_CAP)}>
                        <SearchTopBar
                            tone={theme}
                            barBackground={theme === 'dark' ? '#1A1A1A' : '#FFFFFF'}
                            onBack={() => router.back()}
                            summary={pillText}
                            searching={isLoading || isStreaming}
                            proximity={mapCenter}
                            onSearchSubmit={handleSearchSubmit}
                            theme={theme}
                            onToggleTheme={toggleTheme}
                            view="list"
                            onViewChange={setViewMode}
                            filters={{
                                open: listFiltersOpen,
                                activeCount: listActiveFilterCount,
                                onToggle: () => setListFiltersOpen(v => !v),
                                mobileOnly: true,
                            }}
                            // This page renders no app header in either view, so
                            // without this the list view has no reachable currency
                            // or language control at all — not just the map.
                            showRegionControls
                        />

                        {/* The map view's filter dropdown, on the list's toolbar.
                            Same motion, same offset off the bar, and it keeps its
                            Sort By section — unlike the map's, this toolbar has no
                            sort pill to disagree with.

                            `lg:hidden` matches the button that opens it: past that
                            width the sidebar in the results is the filter surface,
                            and this would be the second one. It closes with the
                            breakpoint rather than lingering as a panel whose button
                            has gone. */}
                        <AnimatePresence>
                            {listFiltersOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 md:right-auto md:w-[300px] lg:hidden"
                                >
                                    <HotelFilters
                                        filters={{ ...listFilters, minPrice: listBounds.min, maxPrice: listBounds.max }}
                                        onChange={(next) => setListFilters(f => ({ ...f, ...next }))}
                                        onReset={() => setListFilters(EMPTY_FILTERS)}
                                        priceRange={priceRange}
                                        currency={currency}
                                        tone={theme}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                {/* Streaming banner — let the user know results are still arriving */}
                <AnimatePresence>
                    {(isLoading || isStreaming) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden px-4 sm:px-6"
                        >
                            <div className="max-w-350 mx-auto pb-2">
                                <div
                                    className="flex items-center gap-2 text-xs font-medium"
                                    style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="shrink-0 animate-spin rounded-full"
                                        style={{
                                            width: 12, height: 12,
                                            border: '1.5px solid currentColor',
                                            borderTopColor: 'transparent',
                                        }}
                                    />
                                    {isLoading
                                        ? 'Searching for stays…'
                                        : `${count}+ stays found · still searching…`
                                    }
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* The same two boxes as the toolbar above, in the same order —
                    the gutter outside, the 350 cap inside. It used to carry both
                    on one div, which put the cap around the padding rather than
                    inside it: past 1400px the results grid sat a gutter's width
                    to the right of the bar, so the filter panel's left edge and
                    the bar's did not line up. Nested this way they share both
                    edges at every width. */}
                <div className={cn('py-6', SHELL_GUTTER)}>
                    <div className={cn('w-full', SHELL_CAP)}>
                        <HotelResults
                            hotels={listHotels as unknown as HotelResult[]}
                            loading={isLoading}
                            error={status === 'error' ? 'Search failed. Please try again.' : null}
                            destination={destination}
                            searchQs={searchQs}
                            filters={listFilters}
                            onFiltersChange={(next) => setListFilters(f => ({ ...f, ...next }))}
                            onFiltersReset={() => setListFilters(EMPTY_FILTERS)}
                        />
                    </div>
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
                    properties={railSorted}
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
                    showPois={showPois}
                    nights={nights}
                />
            </div>

            {/* ── Floating top bar ─────────────────────────────── */}
            {/* The shared toolbar, floating over the basemap on the inverted
                tone and carrying the two controls only this view has: the
                filters button, whose panel hangs off its left edge below, and
                the nearby-places toggle.

                Sort is not among them. It sat here as a pill until the panel
                took the same list over — one control in one place, and the pill
                was desktop-only anyway, so the panel is the only surface both
                breakpoints reach. */}
            <div className={cn('pointer-events-none absolute inset-x-0 top-0 z-30 pt-4', MAP_CHROME_GUTTER)}>
                <div className={cn('relative', SHELL_CAP)}>
                    <SearchTopBar
                        className="pointer-events-auto"
                        tone={uiTone}
                        onBack={() => router.back()}
                        summary={pillText}
                        searching={isLoading || isStreaming}
                        proximity={mapCenter}
                        onSearchSubmit={handleSearchSubmit}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                        view="map"
                        onViewChange={setViewMode}
                        filters={{ open: filtersOpen, activeCount: activeFilterCount, onToggle: () => setFiltersOpen(v => !v) }}
                        pois={{ on: showPois, onToggle: () => setShowPois(v => !v) }}
                        // The map covers the app header, so this bar is the only
                        // place on the screen these two can be reached from.
                        showRegionControls
                    />

                    {/* ── Filter panel ─────────────────────────── */}
                    {/* Hangs off the toolbar's left edge, clearing its own
                        height: full width on a phone, the sidebar's own 300px
                        above it. Inside the bar's box and offset off `100%`
                        rather than the 68/80px it used to guess at, which is
                        the same thing the list view's dropdown does — and this
                        bar changes height at `md` too.

                        The panel reuses the list view's, minus its Sort By
                        section — that value belongs to the sort pill up in the
                        toolbar, and two controls over one value disagree.
                        Dismissed from the same button that opened it, which
                        stays lit for as long as it is up. */}
                    <AnimatePresence>
                        {filtersOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                                className="pointer-events-auto absolute left-0 right-0 top-[calc(100%+8px)] z-30 md:right-auto md:w-[300px]"
                            >
                                <HotelFilters
                                    filters={{ ...mapFilters, minPrice: filterMin, maxPrice: filterMax }}
                                    onChange={(next) => setMapFilters(f => ({ ...f, ...next }))}
                                    onReset={() => { setMapFilters(EMPTY_FILTERS); setSortBy('recommended'); }}
                                    priceRange={priceRange}
                                    currency={currency}
                                    tone={uiTone}
                                    sort={{
                                        value: sortBy,
                                        options: SORT_OPTIONS,
                                        onChange: (v) => setSortBy(v as SortValue),
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                        destination ? `We couldn’t find hotels in ${destination}` : "We couldn’t find any hotels",
                        'Try adjusting your dates or destination',
                    ]}
                    action={{ label: 'Search Again', onClick: () => router.back() }}
                />
            )}

            {/* ── Bottom card rail ──────────────────────────────── */}
            <AnimatePresence>
                {mapFiltered.length > 0 && !railHidden && (
                    <motion.div
                        initial={{ y: 160, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 160, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 170, delay: 0.05 }}
                        className="absolute left-0 right-0 bottom-0 z-20"
                        style={{ pointerEvents: 'none' }}
                    >
                        {/* The toolbar's box, again: the gutter outside, the cap
                            inside. Everything the rail draws — the tally, the
                            controls opposite it, and the strip under both —
                            then starts on the bar's left edge and ends on its
                            right one, instead of the rail running to the window
                            while the bar stopped at 1400. */}
                        <div className={MAP_CHROME_GUTTER}>
                            <div className={SHELL_CAP}>
                                {/* Count + rail controls */}
                                <div className="mb-1.5 flex items-end justify-between md:mb-0.5 md:items-center">
                                    {/* The tally, in the slider's top-left corner.

                                        It was drawn twice and named three ways: this
                                        chip on a phone, a loose grey line above the
                                        desktop rail in colours the tone never reached,
                                        and a third copy in the toolbar. The chip is the
                                        one the design draws, and the rail is what it
                                        counts, so it holds this corner at every width —
                                        on the toolbar’s own geometry above `md`, so the
                                        badge reads as having moved rather than changed. */}
                                    <div
                                        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 md:h-10 md:gap-2 md:px-4 md:py-0"
                                        style={{
                                            background: chrome.surface,
                                            border: `1px solid ${chrome.border}`,
                                            boxShadow: chrome.shadow,
                                        }}
                                    >
                                        {isStreaming && (
                                            <div className="animate-spin shrink-0" style={{
                                                width: 10, height: 10, borderRadius: '50%',
                                                border: `1.5px solid ${chrome.border}`,
                                                borderTopColor: chrome.text,
                                            }} />
                                        )}
                                        <span className="whitespace-nowrap text-[11.5px] font-semibold md:text-[13px]" style={{ color: chrome.text }}>
                                            {isStreaming ? `${count}+` : count} Stays
                                        </span>
                                    </div>

                                    {/* Right cluster */}
                                    <div className="flex min-w-0 items-center gap-2">
                                        {/* District filter pill — shown when cards are scoped to a neighbourhood */}
                                        {districtBbox && !showAllCityOverride && mapZoom >= DISTRICT_MARKER_THRESHOLD && districtName && (
                                            <button
                                                onClick={() => setShowAllCityOverride(true)}
                                                className="max-w-[60vw] truncate md:max-w-none"
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

                                        {/* Hide the rail. In this row rather than floating
                                            over the strip below: anywhere inside the
                                            scroller it covered a card, and no z-index
                                            fixes that — the cards still have to pass
                                            underneath it. Here it has the line to itself.

                                            On a phone it is drawn down to the count
                                            chip's own height so the two read as one row,
                                            which is what `items-end` on the wrapper is
                                            lining up. */}
                                        <button
                                            onClick={() => setRailHidden(true)}
                                            aria-label="Hide stay cards"
                                            title="Hide cards"
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80 md:h-10 md:w-10"
                                            style={{
                                                background: chrome.surface, border: `1px solid ${chrome.border}`,
                                                boxShadow: chrome.shadow,
                                                pointerEvents: 'auto',
                                            }}>
                                            <ChevronDown size={15} className="md:size-[18px]" style={{ color: chrome.text }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Horizontal scroll cards — wheel handler converts vertical
                            scroll to horizontal. The bottom inset clears the app's
                            bottom nav wherever that nav is on screen. */}
                        <div className={cn('relative', RAIL_PAD_B_MOBILE)} style={{ paddingLeft: isMobile ? RAIL_GUTTER_MOBILE : RAIL_GUTTER }}>
                            <div
                                ref={railScrollRef}
                                className="flex items-end gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
                                // `overflow-x: auto` forces overflow-y to auto too, so a
                                // selected card scaling up would be clipped. The headroom
                                // gives it somewhere to grow; the whole rail is
                                // pointer-transparent so that headroom doesn't swallow
                                // clicks meant for the map.
                                style={{ overscrollBehaviorX: 'contain', paddingTop: railHeadroom }}
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
                                        nights={nights}
                                        theme={uiTone}
                                        mobile={isMobile}
                                        elementRef={(el) => {
                                            if (el) railCardEls.current.set(property.id, el);
                                            else railCardEls.current.delete(property.id);
                                        }}
                                    />
                                ))}
                                {/* Mirrors the strip's left inset so the last card
                                    doesn't butt against the window edge */}
                                <div style={{ minWidth: isMobile ? RAIL_GUTTER_MOBILE : RAIL_GUTTER, flexShrink: 0 }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bring the rail back */}
            <AnimatePresence>
                {mapFiltered.length > 0 && railHidden && (
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
                        // Rides the same bottom inset as the rail it restores, so
                        // it clears the app's bottom nav too, and the same box, so
                        // it comes back on the right edge the Hide button it
                        // replaces sat on rather than out at the window's.
                        className={cn('pointer-events-none absolute inset-x-0 z-20', SHELL_GUTTER, RAIL_BOTTOM_MOBILE)}
                    >
                        <div className={cn('flex justify-end', SHELL_CAP)}>
                            <button
                                onClick={() => setRailHidden(false)}
                                className="pointer-events-auto flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                                style={{
                                    background: chrome.surface, border: `1px solid ${chrome.border}`,
                                    borderRadius: 100, padding: '9px 15px',
                                    fontSize: 12, fontWeight: 700, color: chrome.text,
                                    boxShadow: chrome.shadow,
                                }}>
                                <ChevronUp size={14} />
                                Show {count} stays
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </motion.div>
        )}
        </AnimatePresence>
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
