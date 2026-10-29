'use client';

import { useTranslations } from 'next-intl';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
    AirVent, Bath, Bed, Building2, Check, ChevronLeft, ChevronRight,
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
 * The grey cancellation line under a room's facts.
 *
 * Returns `null` for a non-refundable rate, which the row words from the
 * messages instead ("Non-refundable") — this function's English is the
 * refundable side only.
 *
 * "Free cancellation up to 24h before check-in" whenever the deadline sits a
 * whole number of hours before check-in *and* the supplier gave us a check-in to
 * measure from; the hours-before figure is the one thing that genuinely
 * separates two otherwise identical refundable rates. With no check-in, or a
 * deadline that does not land on a clean hour, it falls back to the dated form,
 * then to the bare phrase.
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
            if (hours >= 1 && hours <= 168) return `Free cancellation up to ${hours}h before check-in`;
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
 * A room's own photographs, under whichever name the API sent them.
 *
 * v1 and older api-v2 builds send `roomPhotos`; current api-v2 leaves that unset and puts the
 * matched ETG room group's pictures in `content.gallery`. Reading only the first sent every card
 * back to the hotel's exterior shot even though each room had ten pictures of its own.
 */
export function roomPhotosOf(room: RoomOption): string[] {
    if (room.roomPhotos?.length) return room.roomPhotos;
    return room.content?.gallery ?? [];
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
     * The hotel's own photo, for rooms that came back without `roomPhotos`.
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
     * count of hours before the stay ("Free cancellation up to 24h before check-in").
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
         * Each rate's card — slate-900 in dark, matched to the detail modal
         * below so a card and the modal it opens read as one surface. Square,
         * and lifted by a short shadow.
         */
        card:     dark
            ? 'bg-slate-900 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.85),0_1px_3px_rgba(0,0,0,0.6)]'
            : 'bg-white shadow-[0_4px_10px_-2px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)]',
        name:     dark ? 'text-white' : 'text-slate-900',
        feature:  dark ? 'text-slate-400' : 'text-slate-500',
        /** The bulleted facts line — in the design's full ink, not the muted grey. */
        fact:     dark ? 'text-slate-200' : 'text-slate-900',
        /** The cancellation line under the facts. */
        terms:    dark ? 'text-slate-500' : 'text-slate-400',
        /** "Room details" — a plain text link, the one blue on the row. */
        link:     dark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700',
        price:    dark ? 'text-white' : 'text-slate-900',
        unit:     dark ? 'text-slate-500' : 'text-slate-400',
        imageBg:  dark ? 'bg-white/[0.06]' : 'bg-slate-200',
        /**
         * The card's "Select" — the design's flat block, filled with the brand
         * gradient the filter chips and pager use. Filled while it can be
         * pressed, an outline once this rate is the one picked, so the fill
         * still reads as "you can press this".
         */
        selectIdle: 'bg-linear-to-r from-blue-600 to-cyan-500 text-white hover:brightness-110',
        selectOn:   dark
            ? 'bg-transparent text-sky-300 ring-1 ring-inset ring-sky-300'
            : 'bg-white text-blue-600 ring-1 ring-inset ring-blue-600',
        /**
         * The detail modal's "Select Room" — the bright, pressable pill, in the
         * brand gradient. It runs the opposite way round to the rest of the app
         * on purpose: the gradient is the *available* state and the quiet
         * outline the *taken* one, so brightness reads as "you can press this",
         * not as "this is on".
         */
        pillIdle: 'bg-linear-to-r from-blue-600 to-cyan-500 text-white hover:brightness-110',
        pillOn:   dark
            ? 'border border-white/45 bg-white/[0.04] text-white'
            : 'border border-slate-300 bg-white text-slate-900',
        /**
         * The room-card filter row and the pager under it — the conventional
         * direction, unlike the Select buttons above: the active choice is the solid
         * fill — the brand gradient, in both themes — and the rest are quiet
         * outlines.
         */
        filterOn:   'bg-linear-to-r from-blue-600 to-cyan-500 text-white',
        filterIdle: dark
            ? 'border border-white/25 bg-transparent text-white/70 hover:bg-white/[0.06]'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        /** The recessive status pills in the detail modal — a translucent fill,
         *  not the bright CTA treatment of the filter pills. */
        tag:      dark ? 'bg-white/[0.08] text-slate-300' : 'bg-slate-100 text-slate-600',
        /** The detail modal — the same slate-900 as the room card that opens it. */
        modalBg:      dark ? 'bg-slate-900' : 'bg-white',
        modalTitle:   dark ? 'text-white' : 'text-slate-900',
        modalLabel:   dark ? 'text-slate-500' : 'text-slate-400',
        modalClose:   dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700',
        empty:    dark ? 'text-slate-500' : 'text-slate-400',
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
 * The facts the design bullets under the room name: what you sleep on, how many
 * of you, how big the room is. Each appears only when its fact is known — the
 * property endpoint sends no size at all today, so most rows show two (plus the
 * board, which the row adds after them).
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
 * The in-room amenities, for the modal's "Room" section only — the row shows
 * the structural facts and keeps these behind "Room details".
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

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * One rate of one room, worded for its card — one card each; see `ordered` in
 * `RoomSelection` for the order they are drawn in.
 */
interface RateCard {
    room: RoomOption;
    rate: RateRow;
    heading: string;
    /** The structural facts bulleted under the name — see `structuralDetails`. */
    roomDetails: Feature[];
    /** The refundable rate's cancellation line; `null` for a non-refundable one. */
    terms: string | null;
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
    /** The room's own photographs. Empty → the hotel's shot stands in, labelled as such. */
    photos: string[];
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
    const tAll = useTranslations();
    const t = useTranslations('property');
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
        && (roomContent.keyFacts.length > 0 || roomContent.sections.length > 0);
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
                    aria-label={tAll('trips.cancellationModal.close')}
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

                {/*
                  * The room's photographs, independent of whether ETG also matched key facts
                  * or sections. They used to hang off `content.gallery` inside the branch
                  * below, so a room with eight pictures and no other content showed the
                  * hotel's exterior instead — and since nothing ever built `content`, that
                  * was every room.
                  */}
                {card.photos.length > 0 ? (
                    <div className="mt-4 flex gap-2 overflow-x-auto">
                        {card.photos.map((src, i) => (
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
                ) : galleryFallback && (
                    <div className="mt-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={galleryFallback} alt="" className="h-40 w-full rounded-lg object-cover" />
                        <p className={cn('mt-1 text-[12px]', palette.empty)}>{t('v2.photoOfProperty')}</p>
                    </div>
                )}

                {hasRoomContent ? (
                    <>
                        {roomContent!.keyFacts.length > 0 && (
                            <section className="mt-5">
                                <KeyFactsRow facts={roomContent!.keyFacts} palette={palette} />
                            </section>
                        )}
                    </>
                ) : (
                    card.allFeatures.length > 0 && (
                        <section className="mt-6">
                            <p className={sectionLabel}>{tAll('property.rooms.room')}</p>
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
                        <p className={sectionLabel}>{t('v2.mealPlan')}</p>
                        <p className={cn('mt-2 flex items-center gap-2 text-[15px]', palette.feature)}>
                            <UtensilsCrossed size={17} strokeWidth={1.75} className="shrink-0" />
                            {card.boardName}
                        </p>
                    </section>
                )}

                <section className="mt-6">
                    <p className={sectionLabel}>{t('v2.cancellationPolicy')}</p>
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
                        <p className={sectionLabel}>{t('v2.additionalInfo')}</p>
                        <p className={cn('mt-2 whitespace-pre-line text-[14px]', palette.feature)}>{additionalInfo}</p>
                    </section>
                )}

                <section className="mt-6">
                    <p className={sectionLabel}>{t('v2.price')}</p>
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
                        {tAll('trips.cancellationModal.close')}
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
            {lightboxStart !== null && card.photos.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                    <Lightbox
                        images={card.photos}
                        startIndex={lightboxStart}
                        onClose={() => setLightboxStart(null)}
                    />
                </div>
            )}
        </div>,
        document.body,
    );
}

/**
 * One rate, drawn as one whole card, as the design lays it out: the photo, then
 * the name, a bulleted line of facts ending in the board, the cancellation terms,
 * and a last line with "Room details" on the left and Select on the right. The
 * price, which the design leaves off, sits just before Select on that line:
 * eight cards for one room differ by little else.
 *
 * Every card states its room in full, so a room sold eight ways is eight cards
 * that each read on their own; `RoomSelection` keeps them next to each other.
 *
 * The photo sits beside the text and fills the card's height, so the card is as
 * tall as its text and no taller. On a card narrower than `@lg` — a phone, or the
 * half-width column on a small laptop — it moves above the text at a fixed,
 * modest height: beside it, the text would be too narrow to keep "Room details",
 * the price and Select on one line.
 */
function RoomCard({
    card, image, selectedOfferId, palette, currency, nights, onSelect,
    propertySections, additionalInfo,
}: {
    card: RateCard;
    image?: string | null;
    selectedOfferId?: string | null;
    palette: Palette; currency: string; nights?: number | null;
    onSelect: (offer: SelectedOffer) => void;
    propertySections?: DetailSection[];
    additionalInfo?: string;
}) {
    const tAll = useTranslations();
    const [modalOpen, setModalOpen] = useState(false);
    const selected = card.rate.offerId === selectedOfferId;

    // The room's own photo where there is one, the hotel's where there is not.
    //
    // This used to take the hotel's unconditionally, which made every row on a property
    // identical — the same building shot beside "Deluxe Double" and "Superior Double", so the
    // one thing a reader is comparing looked the same for both. The expanded panel below has
    // always preferred the room's own photographs and kept the hotel shot as its fallback;
    // the two disagreeing is what made this look deliberate rather than missed.
    //
    // Always the gallery's first. Two rooms matched to one ETG room group share a gallery, and
    // so a lead photo — but the photos after the first are not reliably of the room (the
    // building, the toiletries, the bathroom), so reaching past it to tell the two apart would
    // put a picture on the card that is not the room at all.
    const photo = card.photos[0] ?? image;
    const symbol = currencySymbol(currency) || currency;
    /** The bulleted line: what the room is, then the board this rate comes with. */
    const facts = card.boardName
        ? [...card.roomDetails.map(f => f.label), card.boardName]
        : card.roomDetails.map(f => f.label);

    return (
        <article className={cn('@container px-5 py-5 sm:px-7 sm:py-8', palette.card)}>
            <div className="flex flex-col gap-4 @lg:flex-row @lg:gap-6">
                {/* Square-cornered. Beside the text it takes a third of the
                    card's width and stretches to the text's height, so it fills
                    the space the text leaves rather than setting a size of its
                    own — a fixed proportion left a band of white under a short
                    photo, and a full-width one stacked on top was oversized. The
                    image is absolutely placed so it cannot push the card taller;
                    `min-h-36` keeps it from becoming a sliver beside short text. */}
                <div
                    className={cn(
                        'relative h-44 w-full shrink-0 overflow-hidden @lg:h-auto @lg:min-h-36 @lg:w-[34%] @lg:max-w-[260px] @lg:self-stretch',
                        palette.imageBg,
                    )}
                >
                    {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                    <h4 className={cn('text-[20px] leading-[1.2] font-bold tracking-[-0.01em] @md:text-[24px]', palette.name)}>
                        {card.heading}
                    </h4>

                    {facts.length > 0 && (
                        <ul className={cn('mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px] font-semibold', palette.fact)}>
                            {facts.map((fact, i) => (
                                <li key={`${fact}-${i}`} className="flex items-center gap-2 capitalize">
                                    <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-current" />
                                    {fact}
                                </li>
                            ))}
                        </ul>
                    )}

                    <p className={cn('mt-2 text-[14px]', palette.terms)}>
                        {card.terms ?? tAll('hotels.rooms.nonRefundable')}
                    </p>

                    {/* "Room details", the price and Select on one line, the pair
                        held to the right edge. A currency with long figures can
                        still run out of room on a narrow card; then the pair
                        wraps under the link, on the right. */}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={() => setModalOpen(true)}
                            className={cn('cursor-pointer text-[14px] font-bold whitespace-nowrap underline-offset-2 transition-colors hover:underline', palette.link)}
                        >
                            {tAll('hotels.rooms.roomDetails')}
                        </button>

                        <div className="ml-auto flex items-center gap-3">
                            <p className="whitespace-nowrap">
                                <span className={cn('text-[18px] font-bold', palette.price)}>
                                    {symbol}{Math.round(card.nightly).toLocaleString()}
                                </span>
                                <span className={cn('text-[12px]', palette.unit)}>{tAll('hotels.perNight')}</span>
                            </p>
                            {/* Only this button picks the rate — the card is not
                                clickable — and the selected state lives on it. */}
                            <button
                                type="button"
                                onClick={() => onSelect({ room: card.room, rate: card.rate })}
                                aria-pressed={selected}
                                className={cn(
                                    'shrink-0 cursor-pointer rounded-[2px] px-5 py-1.5 text-[14px] font-bold whitespace-nowrap transition-[filter,color]',
                                    selected ? palette.selectOn : palette.selectIdle,
                                )}
                            >
                                {selected ? 'Selected' : 'Select'}
                            </button>
                        </div>
                    </div>
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
        </article>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Cards per page — a long rate list is paged rather than scrolled past. */
const CARDS_PER_PAGE = 5;

/**
 * The page-to-page slide's curve and length. easeInOutSine rather than a
 * decelerating curve on purpose: it keeps the column moving at a visible
 * pace the whole way across instead of covering most of the distance in the
 * first fifth of the time and then coasting, which reads as a snap however
 * long the duration is set.
 */
const PAGE_EASE = [0.37, 0, 0.63, 1] as [number, number, number, number];
const PAGE_SLIDE_SECONDS = 1;

export function RoomSelection({
    rooms, image, hotelAmenities, nights, checkIn, occupancy, currency,
    selectedOfferId, onSelect, tone, propertySections, additionalInfo, className, id,
}: RoomSelectionProps) {
    const tAll = useTranslations();
    const t = useTranslations('property');
    const { theme } = useTheme();
    const palette = roomPalette(tone ?? theme);
    const [filter, setFilter] = useState<RoomFilter>('all');
    /** Which page of the filtered list is showing, and which way the last move
     *  went (1 next, −1 prev, 0 = first render, no slide). Page resets to 0
     *  whenever the filter changes — see the filter buttons below. */
    const [page, setPage] = useState(0);
    const [pageDir, setPageDir] = useState(0);

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
        return ratesOf(room).map((rate) => ({
            room,
            rate,
            heading: split.name,
            roomDetails: structural,
            terms: cancellationTerms(rate, checkIn),
            allFeatures: [...structural, ...amenities],
            boardPill: boardPillLabel(rate),
            boardName: boardLabel(rate),
            refundable: isRefundable(rate),
            cancellation: cancellationSummary(rate),
            // Supplier prices cover the whole stay; the card prints a night.
            // The wire already carries a nightly figure; `stayNights` below multiplies it
            // back up for the "× N nights" line, which is the only place a total belongs.
            nightly: convertCurrency(rate.price, rate.currency || 'USD', currency),
            content: room.content,
            photos: roomPhotosOf(room),
        }));
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

    /**
     * The cards in reading order: one per rate, a room's rates kept together.
     *
     * Every rate is a card of its own, the room drawn in full on each. Sorted by price
     * alone, a room sold eight ways would scatter its eight cards between other rooms', so
     * they are grouped by room first — cheapest room first, each room's rates cheapest
     * first — and a reader compares one room's terms side by side before moving on.
     *
     * Grouped *after* filtering, so only rates that survived the chips are placed. Keyed on
     * the heading because that is what a reader distinguishes rooms by — two supplier room
     * codes with one display name are one room to the person choosing.
     */
    const ordered = useMemo(() => {
        const byRoom = new Map<string, RateCard[]>();
        for (const card of filtered) {
            const key = card.heading;
            const existing = byRoom.get(key);
            if (existing) existing.push(card);
            else byRoom.set(key, [card]);
        }
        const groups = [...byRoom.values()].map(rates => [...rates].sort((a, b) => a.nightly - b.nightly));
        return groups.sort((a, b) => a[0].nightly - b[0].nightly).flat();
    }, [filtered]);

    const pageCount = Math.max(1, Math.ceil(ordered.length / CARDS_PER_PAGE));
    // Clamped, not trusted: the filter can shrink the list under a page index
    // that has already been moved past the new end.
    const safePage = Math.min(page, pageCount - 1);
    const paged = ordered.slice(safePage * CARDS_PER_PAGE, safePage * CARDS_PER_PAGE + CARDS_PER_PAGE);

    /** Turn to a page, recording the direction so the incoming column slides
     *  in from that side. The scroll position is left where it is — the pager
     *  sits right under the list, so the next page is already in view. */
    const goToPage = (next: number) => {
        const clamped = Math.max(0, Math.min(pageCount - 1, next));
        if (clamped === safePage) return;
        setPageDir(clamped > safePage ? 1 : -1);
        setPage(clamped);
    };

    if (rooms.length === 0) return null;

    /*
     * Three children, always in this order — the heading and filters, the room
     * cards, the pager — and spaced by the section's own gap rather than by
     * margins on them. That is what lets the property page lay this section into a
     * subgrid beside the map: each child becomes one row, and the cards' row is
     * the one the map shares.
     */
    return (
        <section id={id} className={cn('flex flex-col gap-4', className)}>
            <div>
                <h2 className={cn(SECTION_HEADING, palette.heading)}>{t('v2.availableRooms')}</h2>

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
            </div>

            {/* No clip on this wrapper: `body` is already `overflow-x: clip`
                (globals.css), so the page turn's off-screen start cannot flash
                a scrollbar — and leaving this open lets each card's drop shadow
                render in full instead of being cropped at a tight edge. */}
            <div>
                <motion.div
                    // Keyed by the page, so each turn is a fresh mount that
                    // runs `initial`. `pageDir === 0` on the very first render —
                    // no slide then, the section's own reveal handles that.
                    // Next page enters from the left and travels right; prev
                    // page comes the other way.
                    key={safePage}
                    initial={pageDir === 0 ? false : { x: pageDir > 0 ? -64 : 64, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: PAGE_SLIDE_SECONDS, ease: PAGE_EASE }}
                    className="flex flex-col gap-4"
                >
                    {paged.map((card) => (
                        <RoomCard
                            key={card.rate.offerId}
                            card={card}
                            image={image}
                            currency={currency}
                            nights={nights}
                            selectedOfferId={selectedOfferId}
                            palette={palette}
                            onSelect={onSelect}
                            propertySections={propertySections}
                            additionalInfo={additionalInfo}
                        />
                    ))}

                    {filtered.length === 0 && (
                        <p className={cn('py-8 text-center text-[18px]', palette.empty)}>
                            {tAll('hotels.rooms.noMatch')}
                        </p>
                    )}
                </motion.div>
            </div>

            {pageCount > 1 && (
                <nav className="flex items-center justify-end gap-3" aria-label={tAll('hotels.rooms.pages')}>
                    <button
                        type="button"
                        onClick={() => goToPage(safePage - 1)}
                        disabled={safePage === 0}
                        aria-label={tAll('hotels.rooms.prevPage')}
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
                        aria-label={tAll('hotels.rooms.nextPage')}
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
