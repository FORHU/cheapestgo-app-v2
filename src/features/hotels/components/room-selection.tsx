'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
    AirVent, Bath, Bed, Building2, CalendarClock, Check, ChevronLeft, ChevronRight,
    Coffee, Dog, Maximize2, Refrigerator, ShieldCheck, Sparkles, Tv, UtensilsCrossed,
    Users, Wifi, Wind, X, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { SECTION_HEADING } from '@/shared/lib/layout';
import { DetailSectionGrid, KeyFactsRow } from './room-content';
import { Lightbox } from './lightbox';
import type {
    RateRow, RoomOption, RoomContent, DetailSection,
} from '@/features/hotels/types/property.types';

/**
 * What each board code is called on the card.
 *
 * A code that is not in here falls back to whatever the supplier called it, and
 * failing that draws no board pill at all: an unknown code is not evidence for
 * any particular meal arrangement.
 */
const BOARD_LABELS: Record<string, string> = {
    RO: 'Room Only',
    OB: 'Room Only',
    SC: 'Room Only',
    BB: 'Breakfast Included',
    HB: 'Half Board',
    FB: 'Full Board',
    AI: 'All Inclusive',
};

/**
 * The board pill's wording — a size shorter than the label above, so two pills
 * and a room name still fit one line. "Breakfast Included" becomes "Breakfast";
 * everything else is already short enough to reuse.
 */
const BOARD_PILL_LABELS: Record<string, string> = {
    RO: 'Room Only',
    OB: 'Room Only',
    SC: 'Room Only',
    BB: 'Breakfast',
    CB: 'Breakfast',
    AB: 'Breakfast',
    EB: 'Breakfast',
    HB: 'Half Board',
    FB: 'Full Board',
    AI: 'All Inclusive',
};

/** Board codes that include a morning meal, which is what the filter asks. */
const BOARD_WITH_BREAKFAST = ['BB', 'HB', 'FB', 'AI'];

export type RoomFilter = 'all' | 'breakfast' | 'refundable' | 'non-refundable';

const FILTERS: { value: RoomFilter; label: string }[] = [
    { value: 'all',            label: 'All' },
    { value: 'breakfast',      label: 'Breakfast Included' },
    { value: 'refundable',     label: 'Refundable' },
    { value: 'non-refundable', label: 'Non-refundable' },
];

/** What a click on "Select Room" hands back: the room, and which of its rates. */
export interface SelectedOffer {
    room: RoomOption;
    rate: RateRow;
}

/** The searched party — the occupancy the rate on the card was quoted for. */
export interface Occupancy {
    adults: number;
    children: number;
}

/**
 * Whether a refundable tag says yes.
 *
 * Two vocabularies are in play — the search stream says `RFN`, the property
 * endpoint says `REFUNDABLE` — and a rate tagged in one of them must not read
 * as non-refundable just because the other was expected.
 */
function isRefundableTag(tag?: string): boolean {
    return /^(rfn|refundable)$/i.test(tag ?? '');
}

function isRefundable(rate: RateRow): boolean {
    return rate.refundable === true || isRefundableTag(rate.refundableTag);
}

function fmtDate(raw?: string | null): string {
    if (!raw) return '';
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The Payment Terms cancellation line.
 *
 * Returns `null` for a non-refundable rate — the "Non-refundable" pill above the
 * columns has already said so, and a second negative line adds nothing.
 *
 * "24-hour free cancellation" whenever the deadline sits a whole number of hours
 * before check-in *and* the supplier gave us a check-in to measure from; the
 * hours-before figure is the one thing that genuinely separates two otherwise
 * identical refundable rates. With no check-in, or a deadline that does not land
 * on a clean hour, it falls back to the dated form, then to the bare phrase.
 */
function cancellationTerms(rate: RateRow, checkIn?: string | null): string | null {
    if (!isRefundable(rate)) return null;

    const raw = rate.cancellationDeadline;
    if (!raw) return 'Free cancellation';

    const deadline = new Date(raw);
    if (Number.isNaN(deadline.getTime())) return 'Free cancellation';

    if (checkIn) {
        const start = new Date(checkIn);
        if (!Number.isNaN(start.getTime())) {
            const hours = Math.round((start.getTime() - deadline.getTime()) / 3_600_000);
            if (hours >= 1 && hours <= 168) return `${hours}-hour free cancellation`;
        }
    }

    return `Free cancellation until ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * The cancellation policy the modal spells out in full — always a sentence, even
 * for the non-refundable rates the card's own line stays silent on.
 */
function cancellationSummary(rate: RateRow): string {
    if (!isRefundable(rate)) {
        return 'Non-refundable — this rate cannot be cancelled or amended.';
    }
    const raw = rate.cancellationDeadline;
    if (!raw) return 'Free cancellation before the stay.';
    const deadline = new Date(raw);
    if (Number.isNaN(deadline.getTime())) return 'Free cancellation before the stay.';
    return `Free cancellation until ${fmtDate(raw)}. Cancelling after that date incurs a charge.`;
}

/**
 * A room's rates, always at least one.
 *
 * Suppliers that return a single price per room send no `rates` array at all,
 * so one is synthesised from the room's own fields. Exported because the page
 * prices the stay off the same list — two different ideas of "the rates" would
 * put a different figure in the header than on the cards.
 */
export function ratesOf(room: RoomOption): RateRow[] {
    if (room.rates?.length) return room.rates;
    return [{
        offerId:       room.offerId ?? room.id,
        price:         room.price,
        currency:      room.currency,
        boardCode:     room.boardType,
        boardName:     room.boardName,
        refundable:    isRefundableTag(room.refundableTag),
        refundableTag: room.refundableTag ?? 'NON_REFUNDABLE',
        cancellationDeadline: room.cancellationDeadline,
    }];
}

interface RoomSelectionProps {
    rooms: RoomOption[];
    /**
     * The hotel's own photo, for rooms that came back without `roomImages`.
     * Not a picture of the room, and the card treats it as such: it is the
     * plate behind the rate rather than a claim about what you get.
     */
    image?: string | null;
    /**
     * The hotel's amenity list, as a fallback for rates that carry none of
     * their own — see `amenityFeatures`.
     */
    hotelAmenities?: string[];
    /**
     * Nights in the stay. Supplier prices cover the *whole stay*, so this is
     * what turns one into the per-night figure the card prints. Absent, the
     * price is shown as it arrived.
     */
    nights?: number | null;
    /**
     * Check-in date, used only to word the free-cancellation line as a
     * count of hours before the stay ("24-hour free cancellation").
     */
    checkIn?: string | null;
    /**
     * The searched party. The rate on each card was quoted for exactly this
     * occupancy, so the card prints it as "2 Adults" under Room Details.
     */
    occupancy?: Occupancy;
    /** The currency to price in — the user's, not the supplier's. */
    currency: string;
    /** The chosen rate, by `offerId`; a room can offer several. */
    selectedOfferId: string | null;
    onSelect: (offer: SelectedOffer) => void;
    /** Which palette to draw from. Defaults to the app theme; the property page
     *  passes its own in. */
    tone?: 'light' | 'dark';
    /**
     * Hotel-scoped policy sections (child policy, cribs/extra beds) and the
     * free-text tail — both from the ETG content the API attaches. Shown inside
     * every room's detail modal, after the room-scoped sections.
     */
    propertySections?: DetailSection[];
    additionalInfo?: string;
    className?: string;
    id?: string;
}

function roomPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        heading: dark ? 'text-white' : 'text-slate-900',
        /**
         * The card's plate. Cool rather than neutral, as drawn. No border —
         * a layered drop shadow does the lifting. In light that shadow reads
         * directly; in dark, against the page's black, the shadow is felt only
         * at the near edge, so the plate is also set a shade lighter than it
         * would otherwise be to hold its own outline by contrast alone.
         */
        card:     dark
            ? 'bg-[#1B2434] shadow-[0_20px_48px_-16px_rgba(0,0,0,0.9),0_6px_16px_-8px_rgba(0,0,0,0.7)]'
            : 'bg-white shadow-[0_20px_44px_-16px_rgba(15,23,42,0.28),0_6px_14px_-8px_rgba(15,23,42,0.16)]',
        name:     dark ? 'text-white' : 'text-slate-900',
        feature:  dark ? 'text-white/60' : 'text-slate-500',
        price:    dark ? 'text-white' : 'text-slate-900',
        unit:     dark ? 'text-white/45' : 'text-slate-400',
        imageBg:  dark ? 'bg-white/[0.06]' : 'bg-slate-100',
        /**
         * "Select Room" — the bright, pressable pill. It runs the opposite way
         * round to the rest of the app on purpose: white is the *available*
         * state and dark is the *taken* one, so brightness reads as "you can
         * press this", not as "this is on".
         */
        pillIdle: dark ? 'bg-white text-[#111111] hover:bg-white/85' : 'bg-slate-900 text-white hover:bg-slate-700',
        pillOn:   dark
            ? 'border border-white/45 bg-white/[0.04] text-white'
            : 'border border-slate-300 bg-white text-slate-900',
        /**
         * The room-card filter row and the pager under it — the conventional
         * direction, unlike "Select Room" above: the active choice is the solid
         * fill, the rest are quiet outlines. Dark mode can't fill with black on
         * a black page, so its active pill is white — the same "this one is on"
         * cue, inverted.
         */
        filterOn:   dark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white',
        filterIdle: dark
            ? 'border border-white/25 bg-transparent text-white/70 hover:bg-white/[0.06]'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        /** The recessive status pills beside the room name — a translucent fill,
         *  not the bright CTA treatment of the filter pills. */
        tag:      dark ? 'bg-white/[0.08] text-white/70' : 'bg-slate-100 text-slate-600',
        /** The "Room Details" / "Payment Terms" column labels and their dot. */
        columnHeading: dark ? 'text-white/80' : 'text-slate-700',
        columnDot:     dark ? 'bg-white/40' : 'bg-slate-400',
        /** The two "View more" links under the columns. */
        viewMore: dark ? 'text-white/55 hover:text-white/85' : 'text-slate-500 hover:text-slate-800',
        /** The detail modal. */
        modalBg:      dark ? 'bg-[#131A24]' : 'bg-white',
        modalTitle:   dark ? 'text-white' : 'text-slate-900',
        modalLabel:   dark ? 'text-white/45' : 'text-slate-400',
        modalClose:   dark ? 'text-white/50 hover:text-white/85' : 'text-slate-400 hover:text-slate-700',
        empty:    dark ? 'text-white/45' : 'text-slate-400',
    };
}

type Palette = ReturnType<typeof roomPalette>;

/**
 * An icon per room feature, matched on the words suppliers use. First match
 * wins, so the specific patterns lead.
 *
 * Unlike the amenity chips in the description section, this one *does* fall
 * back. These are a vertical list: the icons form the list's left edge, and a
 * row without one would hang its label out into the gutter the others keep.
 */
const FEATURE_ICONS: [RegExp, LucideIcon][] = [
    [/bed|twin|double|queen|king|sofa/i,            Bed],
    [/view|balcony|terrace|window|city|sea|ocean/i, Building2],
    [/wi-?fi|internet|broadband/i,                  Wifi],
    [/air ?condition|climate|\ba\/?c\b/i,           AirVent],
    [/heat|fan|ventilat/i,                          Wind],
    [/bath|shower|toilet|towel|toiletr/i,           Bath],
    [/\btv\b|television|satellite|streaming/i,      Tv],
    [/fridge|minibar|refrigerat|kettle/i,           Refrigerator],
    [/breakfast|coffee|tea\b/i,                     Coffee],
    [/guest|occupan|person|adult|sleeps/i,          Users],
    [/\bpets?\b|dog/i,                              Dog],
    [/clean|housekeep|linen/i,                      Sparkles],
];

function featureIcon(label: string): LucideIcon {
    for (const [pattern, icon] of FEATURE_ICONS) {
        if (pattern.test(label)) return icon;
    }
    return Check;
}

interface Feature { label: string; icon: LucideIcon }

/**
 * Suppliers hang the bed in a parenthetical on the room name — "Standard Double
 * room (full double bed)" — so the card splits it: the heading takes the name
 * without it, the rows take what was inside.
 */
function splitRoomName(name: string): { name: string; bed: string | null } {
    const match = /\(([^)]+)\)\s*$/.exec(name);
    if (!match) return { name, bed: null };
    return { name: name.replace(/\s*\([^)]+\)\s*$/, '').trim(), bed: match[1].trim() };
}

/**
 * The bed, read out of the room's own name.
 *
 * A last fallback for the case where a supplier sends no `bedType` and no
 * parenthetical but has written it into the name anyway — "Double Room, 1 king
 * bed", "Twin Room". The count is kept where it is given and assumed to be one
 * where it is not, which is what "Twin Room" means.
 */
function bedFromName(name: string): string | null {
    const explicit = /\b(\d+)\s*(king|queen|double|single|twin|bunk|sofa)(?:[-\s]?sized?)?\s*beds?\b/i.exec(name);
    if (explicit) {
        const count = Number(explicit[1]);
        const kind = explicit[2].toLowerCase();
        return `${count} ${kind} bed${count === 1 ? '' : 's'}`;
    }
    const implied = /\b(king|queen|double|single|twin)(?:[-\s]?sized?)?(?:\s*beds?)?\b/i.exec(name);
    return implied ? `1 ${implied[1].toLowerCase()} bed` : null;
}

/**
 * Amenities that belong to a *room* rather than to the building.
 *
 * Used to sift the hotel's own list when a rate arrives without one. A pool or
 * a car park is the hotel's; Wi-Fi, the air conditioning and the television are
 * on the other side of the room door, so they are the ones worth repeating on
 * a room card.
 */
const IN_ROOM_AMENITY =
    /wi-?fi|internet|air ?condition|climate|\ba\/?c\b|heating|television|\btv\b|minibar|fridge|refrigerat|safe\b|bathroom|shower|\bbath\b|balcony|terrace|view\b|hair ?dry|desk|kettle|coffee|tea\b|soundproof|iron|towel|toiletr|slipper|bathrobe|wardrobe|closet|linen|telephone/i;

/** "2 Adults", "2 Adults · 1 Child" — the searched party, or nothing. */
function occupancyLabel(occ?: Occupancy): string | null {
    if (!occ || occ.adults < 1) return null;
    const parts = [`${occ.adults} Adult${occ.adults === 1 ? '' : 's'}`];
    if (occ.children > 0) parts.push(`${occ.children} Child${occ.children === 1 ? '' : 'ren'}`);
    return parts.join(' · ');
}

/**
 * The rows the design draws under "Room Details": what you sleep on, how many
 * of you, how big the room is. Each appears only when its fact is known — the
 * property endpoint sends no size at all today, so most cards show two.
 */
function structuralDetails(room: RoomOption, bedHint: string | null, occupancy?: Occupancy): Feature[] {
    const out: Feature[] = [];

    const bed = room.bedType ?? bedHint ?? bedFromName(room.name);
    if (bed) out.push({ label: bed, icon: Bed });

    const occ = occupancyLabel(occupancy)
        ?? (room.maxOccupancy ? `Up to ${room.maxOccupancy} guests` : null);
    if (occ) out.push({ label: occ, icon: Users });

    if (room.size) out.push({ label: `${room.size}sqm`, icon: Maximize2 });

    return out;
}

/**
 * The in-room amenities, for the modal's "Room" section only — the card face
 * shows the three structural rows and keeps these behind "View more".
 *
 * The hotel's list is a fallback, not an addition: read only when the rate
 * itself listed nothing, and then only through `IN_ROOM_AMENITY`.
 */
function amenityFeatures(room: RoomOption, hotelAmenities: string[] = []): Feature[] {
    const amenities = room.amenities?.length
        ? room.amenities
        : hotelAmenities.filter(a => IN_ROOM_AMENITY.test(a));
    return amenities.map(a => ({ label: a, icon: featureIcon(a) }));
}

/** What the rate calls its board, by code first and by the supplier's own
 *  wording second. */
function boardLabel(rate: RateRow): string | undefined {
    return (rate.boardCode ? BOARD_LABELS[rate.boardCode] : undefined) ?? rate.boardName ?? undefined;
}

/** The board pill's short wording, or nothing when the code is unknown. */
function boardPillLabel(rate: RateRow): string | undefined {
    return (rate.boardCode ? BOARD_PILL_LABELS[rate.boardCode] : undefined)
        ?? rate.boardName ?? undefined;
}

// ─── Small parts ──────────────────────────────────────────────────────────────

function Pill({ palette, children }: { palette: Palette; children: React.ReactNode }) {
    return (
        <span className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap',
            palette.tag,
        )}>
            {children}
        </span>
    );
}

function FeatureRow({ feature, palette }: { feature: Feature; palette: Palette }) {
    const Icon = feature.icon;
    return (
        <li className={cn('flex items-start gap-2 text-[15px]', palette.feature)}>
            <Icon size={17} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span className="min-w-0 capitalize">{feature.label}</span>
        </li>
    );
}

/**
 * One of the card's two labelled detail columns. Renders nothing when it has
 * no rows — a heading over an empty list is worse than an uneven card.
 */
function DetailColumn({
    title, rows, palette, onViewMore, showViewMore = true,
}: {
    title: string; rows: Feature[]; palette: Palette; onViewMore: () => void;
    /** `false` drops the "View more" link (the Payment Terms column). */
    showViewMore?: boolean;
}) {
    if (rows.length === 0) return null;
    return (
        <div className="min-w-0">
            {/* Larger than the rows it labels, no leading dot. */}
            <p className={cn('text-[15px] font-semibold', palette.columnHeading)}>
                {title}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
                {rows.map((row, i) => {
                    const Icon = row.icon;
                    return (
                        <li key={`${row.label}-${i}`} className={cn('flex items-start gap-2 text-[13px]', palette.feature)}>
                            <Icon size={14} strokeWidth={1.75} className="mt-[3px] shrink-0" />
                            <span className="min-w-0 capitalize">{row.label}</span>
                        </li>
                    );
                })}
            </ul>
            {showViewMore && (
                <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={(e) => { e.stopPropagation(); onViewMore(); }}
                    className={cn('mt-2 cursor-pointer text-[12px] font-bold transition-colors', palette.viewMore)}
                >
                    View more
                </button>
            )}
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * One rate, drawn as one card — which is what the design shows: the same room
 * appears once per rate, at that rate's price and board.
 */
interface RateCard {
    room: RoomOption;
    rate: RateRow;
    heading: string;
    /** The three rows under "Room Details". */
    roomDetails: Feature[];
    /** The rows under "Payment Terms" — the cancellation line, when there is one. */
    paymentTerms: Feature[];
    /** Everything the modal's "Room" section lists — structural rows plus amenities. */
    allFeatures: Feature[];
    boardPill?: string;
    boardName?: string;
    refundable: boolean;
    /** Already worded — see `cancellationSummary`. */
    cancellation: string;
    /** Per night, in the user's currency. */
    nightly: number;
    /** ETG room-detail content, when the API matched this room to a room-group.
     *  Absent → the modal falls back to `allFeatures`. */
    content?: RoomContent;
}

function RoomDetailDialog({
    card, palette, currency, nights, selected, onClose, onSelect,
    propertySections, additionalInfo, galleryFallback,
}: {
    card: RateCard; palette: Palette; currency: string; nights?: number | null;
    selected: boolean; onClose: () => void; onSelect: (offer: SelectedOffer) => void;
    /** Hotel-scoped sections (child policy, cribs/extra beds) — appended after the
     *  room sections. */
    propertySections?: DetailSection[];
    additionalInfo?: string;
    /** The hotel photo, shown when the matched room-group carried no images. */
    galleryFallback?: string | null;
}) {
    const [lightboxStart, setLightboxStart] = useState<number | null>(null);

    useEffect(() => {
        // While the photo viewer is open it owns Escape (and closes itself);
        // the modal only takes Escape once the viewer is gone.
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && lightboxStart === null) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, lightboxStart]);

    const symbol = currencySymbol(currency) || currency;
    const stayNights = Math.max(1, nights ?? 1);
    const total = card.nightly * stayNights;
    const penalties = card.room.cancelPolicy?.cancelPenalties?.filter(p => fmtDate(p.deadline)) ?? [];

    const sectionLabel = cn('text-[12px] font-bold tracking-[0.12em] uppercase', palette.modalLabel);

    /**
     * The room-group match can miss even when the hotel has ETG content — the
     * API still attaches a `content` object, but an empty one. Treat that as no
     * match and fall back to the legacy amenity list, the same as when the hotel
     * has no ETG content at all.
     */
    const roomContent = card.content;
    const hasRoomContent = !!roomContent
        && (roomContent.gallery.length > 0 || roomContent.keyFacts.length > 0 || roomContent.sections.length > 0);
    /** Room sections (only when matched) then hotel-scoped policy sections (always). */
    const modalSections = [
        ...(hasRoomContent ? roomContent!.sections : []),
        ...(propertySections ?? []),
    ];
    /** The bed line and cribs summary don't need a room-group match — the first
     *  comes off the room name, the second off the hotel's metapolicy. */
    const bedLine = roomContent?.bedLine;
    const bedsExtraSummary = roomContent?.bedsExtraSummary;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${card.heading} details`}
                onClick={(e) => e.stopPropagation()}
                className={cn('relative z-10 max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[18px] p-6', palette.modalBg)}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className={cn('absolute right-5 top-5 cursor-pointer transition-colors', palette.modalClose)}
                >
                    <X size={18} />
                </button>

                <h3 className={cn('pr-8 text-[22px] font-semibold', palette.modalTitle)}>{card.heading}</h3>

                <div className="mt-3 flex flex-wrap gap-2">
                    {card.boardPill && <Pill palette={palette}>{card.boardPill}</Pill>}
                    <Pill palette={palette}>{card.refundable ? 'Refundable' : 'Non-refundable'}</Pill>
                </div>

                {bedLine && (
                    <p className={cn('mt-4 flex items-center gap-2 text-[15px]', palette.feature)}>
                        <Bed size={17} strokeWidth={1.75} className="shrink-0" />
                        {bedLine}
                    </p>
                )}
                {bedsExtraSummary && (
                    <p className={cn('mt-1 text-[13px]', palette.empty)}>{bedsExtraSummary}</p>
                )}

                {hasRoomContent ? (
                    <>
                        {roomContent!.gallery.length > 0 && (
                            <div className="mt-4 flex gap-2 overflow-x-auto">
                                {roomContent!.gallery.map((src, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={src}
                                        src={src}
                                        alt=""
                                        onClick={() => setLightboxStart(i)}
                                        className="h-28 w-40 shrink-0 cursor-pointer rounded-lg object-cover"
                                    />
                                ))}
                            </div>
                        )}
                        {roomContent!.gallery.length === 0 && galleryFallback && (
                            <div className="mt-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={galleryFallback} alt="" className="h-40 w-full rounded-lg object-cover" />
                                <p className={cn('mt-1 text-[12px]', palette.empty)}>Photo of the property</p>
                            </div>
                        )}

                        {roomContent!.keyFacts.length > 0 && (
                            <section className="mt-5">
                                <KeyFactsRow facts={roomContent!.keyFacts} palette={palette} />
                            </section>
                        )}
                    </>
                ) : (
                    card.allFeatures.length > 0 && (
                        <section className="mt-6">
                            <p className={sectionLabel}>Room</p>
                            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {card.allFeatures.map((feature, i) => (
                                    <FeatureRow key={`${feature.label}-${i}`} feature={feature} palette={palette} />
                                ))}
                            </ul>
                        </section>
                    )
                )}

                {modalSections.length > 0 && (
                    <section className="mt-6">
                        <DetailSectionGrid sections={modalSections} palette={palette} />
                    </section>
                )}

                {card.boardName && (
                    <section className="mt-6">
                        <p className={sectionLabel}>Meal plan</p>
                        <p className={cn('mt-2 flex items-center gap-2 text-[15px]', palette.feature)}>
                            <UtensilsCrossed size={17} strokeWidth={1.75} className="shrink-0" />
                            {card.boardName}
                        </p>
                    </section>
                )}

                <section className="mt-6">
                    <p className={sectionLabel}>Cancellation policy</p>
                    <p className={cn('mt-2 flex items-start gap-2 text-[15px]', palette.feature)}>
                        <ShieldCheck size={17} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                        <span>{card.cancellation}</span>
                    </p>
                    {penalties.length > 0 && (
                        <ul className={cn('mt-2 flex flex-col gap-1 pl-[25px] text-[14px]', palette.empty)}>
                            {penalties.map((p, i) => (
                                <li key={i}>
                                    From {fmtDate(p.deadline)}:{' '}
                                    {p.amount
                                        ? `${currencySymbol(p.currency || currency) || p.currency || symbol}${Math.round(p.amount).toLocaleString()} charge`
                                        : 'free'}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {additionalInfo && (
                    <section className="mt-6">
                        <p className={sectionLabel}>Additional information</p>
                        <p className={cn('mt-2 whitespace-pre-line text-[14px]', palette.feature)}>{additionalInfo}</p>
                    </section>
                )}

                <section className="mt-6">
                    <p className={sectionLabel}>Price</p>
                    <p className={cn('mt-2 text-[15px]', palette.feature)}>
                        {`${symbol}${Math.round(card.nightly).toLocaleString()} / night × ${stayNights} night${stayNights === 1 ? '' : 's'}`}
                    </p>
                    <p className={cn('text-[17px] font-semibold', palette.modalTitle)}>
                        {`Total ${symbol}${Math.round(total).toLocaleString()}`}
                    </p>
                    <p className={cn('mt-1 text-[13px]', palette.empty)}>
                        {`Charged in ${card.rate.currency} at booking.`}
                    </p>
                </section>

                <div className="mt-7 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className={cn('cursor-pointer rounded-full px-6 py-2.5 text-[14px] font-medium', palette.pillOn)}
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => { onSelect({ room: card.room, rate: card.rate }); onClose(); }}
                        aria-pressed={selected}
                        className={cn('cursor-pointer rounded-full px-6 py-2.5 text-[14px] font-medium', palette.pillIdle)}
                    >
                        {selected ? 'Selected' : 'Select Room'}
                    </button>
                </div>
            </div>

            {/* Its own layer — clicks inside the viewer (backdrop, close, arrows)
                must not bubble to the modal's `onClick={onClose}` behind it. */}
            {lightboxStart !== null && card.content && card.content.gallery.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                    <Lightbox
                        images={card.content.gallery}
                        startIndex={lightboxStart}
                        onClose={() => setLightboxStart(null)}
                    />
                </div>
            )}
        </div>,
        document.body,
    );
}

function RoomRateCard({
    card, image, selected, palette, currency, nights, onSelect,
    propertySections, additionalInfo,
}: {
    card: RateCard; image?: string | null; selected: boolean;
    palette: Palette; currency: string; nights?: number | null;
    onSelect: (offer: SelectedOffer) => void;
    propertySections?: DetailSection[];
    additionalInfo?: string;
}) {
    const [modalOpen, setModalOpen] = useState(false);

    // The hotel's photo, not the room's: `roomImages` are the banner's
    // pagination now, where a set of them can actually be looked through.
    const photo = image;
    const symbol = currencySymbol(currency) || currency;
    const pick = () => onSelect({ room: card.room, rate: card.rate });

    return (
        <div
            className={cn(
                // Only the Select button picks the room — the card body is not
                // clickable — and the selected state lives on that button, not
                // as a ring on the card. The whole plate lifts a touch on hover
                // as the one "this is a unit you act on" cue the borderless card
                // otherwise lacks.
                'flex min-h-[132px] overflow-hidden rounded-[14px] transition-transform duration-200 ease-out hover:scale-[1.015]',
                palette.card,
            )}
        >
            {/* Photo — flush into the card's own corners. Square on its own
                account; `overflow-hidden` on the card clips it to the left
                radius and leaves the right side straight, where the panel
                carries on. */}
            <div className={cn('relative w-[34%] max-w-[260px] min-w-[104px] shrink-0 self-stretch overflow-hidden', palette.imageBg)}>
                {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                )}
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">

                {/* Name + pills, price held to the right edge */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                        <h4 className={cn('text-[16px] font-medium sm:text-[17px]', palette.name)}>{card.heading}</h4>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {card.boardPill && <Pill palette={palette}>{card.boardPill}</Pill>}
                            <Pill palette={palette}>{card.refundable ? 'Refundable' : 'Non-refundable'}</Pill>
                        </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-right">
                        <span className={cn('text-[19px] font-bold sm:text-[21px]', palette.price)}>
                            {symbol}{Math.round(card.nightly).toLocaleString()}
                        </span>
                        <span className={cn('text-[12px]', palette.unit)}>/night</span>
                    </p>
                </div>

                {/* Detail columns pulled up directly under the name; the Select
                    action keeps its bottom-right corner via its own `self-end`. */}
                <div className="flex flex-1 items-start justify-between gap-3">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                        <DetailColumn
                            title="Room Details"
                            rows={card.roomDetails}
                            palette={palette}
                            onViewMore={() => setModalOpen(true)}
                        />
                        <DetailColumn
                            title="Payment Terms"
                            rows={card.paymentTerms}
                            palette={palette}
                            onViewMore={() => setModalOpen(true)}
                            showViewMore={false}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={pick}
                        aria-pressed={selected}
                        className={cn(
                            'shrink-0 cursor-pointer self-end rounded-full px-5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:text-[14px]',
                            selected ? palette.pillOn : palette.pillIdle,
                        )}
                    >
                        {selected ? 'Selected' : 'Select Room'}
                    </button>
                </div>
            </div>

            {modalOpen && (
                <RoomDetailDialog
                    card={card}
                    palette={palette}
                    currency={currency}
                    nights={nights}
                    selected={selected}
                    onClose={() => setModalOpen(false)}
                    onSelect={onSelect}
                    propertySections={propertySections}
                    additionalInfo={additionalInfo}
                    galleryFallback={image}
                />
            )}
        </div>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Cards per page — a long rate list is paged rather than scrolled past. */
const ROOMS_PER_PAGE = 5;

/** The eased curve the page-to-page slide runs on. */
const PAGE_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function RoomSelection({
    rooms, image, hotelAmenities, nights, checkIn, occupancy, currency,
    selectedOfferId, onSelect, tone, propertySections, additionalInfo, className, id,
}: RoomSelectionProps) {
    const { theme } = useTheme();
    const palette = roomPalette(tone ?? theme);
    const [filter, setFilter] = useState<RoomFilter>('all');
    /** Which page of the filtered list is showing, and which way the last move
     *  went (1 next, −1 prev, 0 = first render, no slide). Page resets to 0
     *  whenever the filter changes — see the filter buttons below. */
    const [page, setPage] = useState(0);
    const [pageDir, setPageDir] = useState(0);
    const sectionRef = useRef<HTMLElement>(null);

    /**
     * Every rate on offer, one card each — the design draws the same room three
     * times over at three prices, which is what a room with three rates *is*.
     *
     * Flattened here rather than in the page so the filters below can work on
     * rates, which is the only level at which "Breakfast Included" or
     * "Refundable" mean anything: those are properties of a price, not of a room.
     */
    const cards = useMemo<RateCard[]>(() => rooms.flatMap((room) => {
        const split = splitRoomName(room.name);
        const structural = structuralDetails(room, split.bed, occupancy);
        const amenities  = amenityFeatures(room, hotelAmenities);
        return ratesOf(room).map((rate) => {
            const cancellationLine = cancellationTerms(rate, checkIn);
            return {
                room,
                rate,
                heading: split.name,
                roomDetails: structural,
                paymentTerms: cancellationLine
                    ? [{ label: cancellationLine, icon: CalendarClock }]
                    : [],
                allFeatures: [...structural, ...amenities],
                boardPill: boardPillLabel(rate),
                boardName: boardLabel(rate),
                refundable: isRefundable(rate),
                cancellation: cancellationSummary(rate),
                // Supplier prices cover the whole stay; the card prints a night.
                nightly: convertCurrency(rate.price, rate.currency || 'USD', currency) / Math.max(1, nights ?? 1),
                content: room.content,
            };
        });
    }), [rooms, hotelAmenities, occupancy, checkIn, currency, nights]);

    const filtered = useMemo(() => {
        if (filter === 'all') return cards;
        if (filter === 'breakfast') {
            return cards.filter(c => BOARD_WITH_BREAKFAST.includes(c.rate.boardCode ?? ''));
        }
        if (filter === 'refundable') return cards.filter(c => c.refundable);
        // Non-refundable is everything not marked refundable: suppliers are
        // reliable about flagging the refundable ones and patchy about flagging
        // their opposite, so testing the negative tag alone would drop most.
        return cards.filter(c => !c.refundable);
    }, [cards, filter]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / ROOMS_PER_PAGE));
    // Clamped, not trusted: the filter can shrink the list under a page index
    // that has already been moved past the new end.
    const safePage = Math.min(page, pageCount - 1);
    const paged = filtered.slice(safePage * ROOMS_PER_PAGE, safePage * ROOMS_PER_PAGE + ROOMS_PER_PAGE);

    /** Turn to a page and bring the section's top back into view, so the next
     *  page does not start the reader halfway down a list they were at the end
     *  of. Records the direction so the incoming page slides in from that side. */
    const goToPage = (next: number) => {
        const clamped = Math.max(0, Math.min(pageCount - 1, next));
        if (clamped === safePage) return;
        setPageDir(clamped > safePage ? 1 : -1);
        setPage(clamped);
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (rooms.length === 0) return null;

    return (
        <section ref={sectionRef} id={id} className={className}>
            <h2 className={cn(SECTION_HEADING, palette.heading)}>Available Rooms</h2>

            <div className="mt-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => { setFilter(f.value); setPage(0); setPageDir(-1); }}
                        aria-pressed={filter === f.value}
                        // Same pill size as the header's amenity chips.
                        className={cn(
                            'cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors sm:text-[13.5px]',
                            filter === f.value ? palette.filterOn : palette.filterIdle,
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* No clip on this wrapper: `body` is already `overflow-x: clip`
                (globals.css), so the page turn's off-screen start cannot flash
                a scrollbar — and leaving this open lets each card's drop shadow
                render in full instead of being cropped at a tight edge. */}
            <div className="mt-4">
                <motion.div
                    // Keyed by the page, so each turn is a fresh mount that
                    // runs `initial`. `pageDir === 0` on the very first render —
                    // no slide then, the section's own reveal handles that.
                    // Next page enters from the left and travels right; prev
                    // page comes the other way.
                    key={safePage}
                    initial={pageDir === 0 ? false : { x: pageDir > 0 ? -48 : 48, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.34, ease: PAGE_EASE }}
                    className="flex flex-col gap-3"
                >
                    {paged.map((card) => (
                        <RoomRateCard
                            key={`${card.room.id}-${card.rate.offerId}`}
                            card={card}
                            image={image}
                            currency={currency}
                            nights={nights}
                            selected={card.rate.offerId === selectedOfferId}
                            palette={palette}
                            onSelect={onSelect}
                            propertySections={propertySections}
                            additionalInfo={additionalInfo}
                        />
                    ))}
                </motion.div>
            </div>

            {filtered.length === 0 && (
                <p className={cn('mt-4 py-8 text-center text-[18px]', palette.empty)}>
                    No rooms match that rate. Try another filter.
                </p>
            )}

            {pageCount > 1 && (
                <nav className="mt-4 flex items-center justify-end gap-3" aria-label="Room pages">
                    <button
                        type="button"
                        onClick={() => goToPage(safePage - 1)}
                        disabled={safePage === 0}
                        aria-label="Previous page"
                        className={cn(
                            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-30',
                            palette.filterIdle,
                        )}
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className={cn('text-[13px] font-semibold tabular-nums', palette.heading)}>
                        {safePage + 1}
                        <span className={cn('font-normal', palette.empty)}> / {pageCount}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => goToPage(safePage + 1)}
                        disabled={safePage === pageCount - 1}
                        aria-label="Next page"
                        className={cn(
                            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-30',
                            palette.filterIdle,
                        )}
                    >
                        <ChevronRight size={15} />
                    </button>
                </nav>
            )}
        </section>
    );
}
