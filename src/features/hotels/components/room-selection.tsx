'use client';

import { useTranslations } from 'next-intl';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
    AirVent, Bath, Bed, BedDouble, Building2, Check, ChevronLeft, ChevronRight,
    Coffee, Dog, Images, Maximize2, Refrigerator, Sparkles, Tv, User,
    Users, Wifi, Wind, X, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
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
     * The hotel's whole photo set, so cards falling back can take a different one each.
     *
     * Plenty of properties have room groups with no pictures in them — ETG files 56k that way —
     * and every card then drew the same building shot. Three rooms at three prices under one
     * identical photo reads as a broken page rather than as missing data. Taking a different
     * property photo per card claims nothing new (the card never says the photo is of that room,
     * and the expanded panel labels it) and the list stops looking faulty.
     */
    images?: string[];
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
         * below so a card and the modal it opens read as one surface. Rounded,
         * and lifted by a short shadow.
         */
        card:     dark
            ? 'bg-slate-900 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.85),0_1px_3px_rgba(0,0,0,0.6)]'
            : 'bg-white shadow-[0_4px_10px_-2px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)]',
        name:     dark ? 'text-white' : 'text-slate-900',
        feature:  dark ? 'text-slate-400' : 'text-slate-500',
        /** The icon facts under the name — bed, party, size. Secondary ink, as 2a sets them. */
        fact:     dark ? 'text-slate-400' : 'text-slate-600',
        /**
         * The rate rows. The picked one is outlined twice as heavy in the accent and tinted
         * with it; the 1px border plus a 1px inset ring makes the 2px without the row's
         * contents moving when the pick changes. The accent is V2's: blue-600 in light,
         * sky-400 in dark, as the links and the taken Select already are.
         */
        rateOn:   dark
            ? 'border-sky-400 bg-sky-400/10 ring-1 ring-inset ring-sky-400'
            : 'border-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-600',
        rateOff:  dark
            ? 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
        /** A room sold one way: the same box, with nothing to pick. */
        rateOnly: dark ? 'border-white/10' : 'border-slate-200',
        /** The radio dot — a thick accent ring round a hole when on, a hairline when off. */
        dotOn:    dark ? 'border-[5px] border-sky-400 bg-slate-900' : 'border-[5px] border-blue-600 bg-white',
        dotOff:   dark ? 'border-[1.5px] border-slate-600' : 'border-[1.5px] border-slate-300',
        /** Free cancellation — green is kept for terms in the guest's favour. */
        positive: dark ? 'text-green-400' : 'text-green-600',
        /** "Room details" — a plain text link, the one blue on the row. */
        link:     dark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700',
        price:    dark ? 'text-white' : 'text-slate-900',
        unit:     dark ? 'text-slate-500' : 'text-slate-400',
        imageBg:  dark ? 'bg-white/[0.06]' : 'bg-slate-200',
        /**
         * The card's "Select" — a pill, as every other button on the page is, filled with the brand
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
        /** The modal's body copy — the facts, amenities and sections. */
        modalText:    dark ? 'text-slate-300' : 'text-slate-700',
        /** The small uppercase eyebrows over each block. */
        modalLabel:   'text-slate-500',
        /** The 32px round close button. */
        modalClose:   dark
            ? 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14]'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        /** The hairline over the pinned price and Select. */
        modalRule:    dark ? 'border-white/[0.08]' : 'border-slate-100',
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
 * A heading this short is a supplier code rather than a room type: "U (Superior Double room)"
 * files the identity inside the parentheses, and taking them off leaves a card titled "U".
 * Mirrors `MIN_MEANINGFUL_ROOM_NAME` in api-v2's `roomNames.ts`.
 */
const MIN_MEANINGFUL_ROOM_NAME = 3;

/**
 * Parentheticals that describe the **Offer** rather than the Room — see ADR-0007.
 *
 * TGX hangs variant text on the room name instead of putting it in a field, and sends more
 * than one: `Deluxe Twin room (twin beds) (bed type is subject to availability)`. Almost all
 * of what arrives that way *is* the room — bed configuration, `shared bathroom`, `smoking`,
 * `kitchen` — and stripping it wholesale merges rooms that are different products. Only the
 * entries below are terms, so only these come off the name.
 *
 * `chip` is what the reader sees, because the supplier's own wording is too long to sit in a
 * rate row's title beside a price.
 *
 * **Widen this list when a supplier words the same promise differently.** The symptom is a
 * pair of cards a reader cannot tell apart, which is how this was found on 2026-11-04.
 */
const OFFER_QUALIFIERS: readonly { match: RegExp; chip: string }[] = [
    { match: /^bed\s+type\s+is\s+subject\s+to\s+availability$/i, chip: 'bed not guaranteed' },
];

function offerQualifier(qualifier: string): string | null {
    const q = qualifier.trim();
    return OFFER_QUALIFIERS.find(o => o.match.test(q))?.chip ?? null;
}

/**
 * Suppliers hang the bed in a parenthetical on the room name — "Standard Double
 * room (full double bed)" — so the card splits it: the heading takes the name
 * without it, the rows take what was inside.
 *
 * Offer qualifiers come off first and separately. They are not the room and must not title
 * it — a card headed "Deluxe Twin room (twin beds)" whose own bullet read "Bed Type Is
 * Subject To Availability" contradicted itself on screen — but they do tell one Offer from
 * another, so they are returned rather than dropped. ADR-0007.
 */
function splitRoomName(name: string): { name: string; bed: string | null; offerTerms: string[] } {
    const offerTerms: string[] = [];
    const withoutTerms = name
        .replace(/\s*\(([^)]*)\)/g, (match, inner: string) => {
            // Comma-separated, because a supplier packs several into one parenthetical:
            // "(bed type is subject to availability, lounge access)". Classifying the whole
            // parenthetical matched neither, and left those cards split.
            const kept: string[] = [];
            for (const part of inner.split(',')) {
                const chip = offerQualifier(part);
                if (chip) offerTerms.push(chip);
                else if (part.trim()) kept.push(part.trim());
            }
            return kept.length ? ` (${kept.join(', ')})` : '';
        })
        .replace(/\s+/g, ' ')
        .trim();

    const match = /\(([^)]+)\)\s*$/.exec(withoutTerms);
    if (!match) return { name: withoutTerms, bed: null, offerTerms };

    const heading = withoutTerms.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return heading.length >= MIN_MEANINGFUL_ROOM_NAME
        ? { name: heading, bed: match[1].trim(), offerTerms }
        : { name: withoutTerms, bed: null, offerTerms };
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
    if (bed) out.push({ label: bed, icon: BedDouble });

    const occ = occupancyLabel(occupancy)
        ?? (room.maxOccupancy ? `Up to ${room.maxOccupancy} guests` : null);
    if (occ) out.push({ label: occ, icon: User });

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

function FeatureRow({ feature, palette }: { feature: Feature; palette: Palette }) {
    const Icon = feature.icon;
    return (
        <li className={cn('flex items-start gap-1.5 text-[13px]', palette.modalText)}>
            <Icon size={16} strokeWidth={1.75} className="mt-px shrink-0" />
            <span className="min-w-0 capitalize">{feature.label}</span>
        </li>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * One rate of one room, worded for its card — one card each; see `ordered` in
 * `RoomSelection` for the order they are drawn in.
 */

/** Offer qualifiers in a stable order, so two Offers carrying the same ones compare equal. */
function offerTermsKey(card: RateCard): string {
    return [...card.offerTerms].sort().join('+');
}

/**
 * What makes one Offer different from another within a Room: the terms, never the price.
 * Two Offers with the same signature are the same promise, and only the cheaper is worth
 * showing — see the de-duplication in `ordered` and ADR-0007.
 */
function termSignature(card: RateCard): string {
    return [card.boardName ?? '', card.refundable ? 'RFN' : 'NRFN', card.cancellation,
        card.bed ?? '', offerTermsKey(card)].join('|');
}

interface RateCard {
    room: RoomOption;
    rate: RateRow;
    heading: string;
    /** What this rate is sold with — the bed, or whatever else the supplier left in the
     *  parenthetical. It differs between rates on one card, so a rate row must be able to say so. */
    bed: string | null;
    /** Offer qualifiers lifted off the room name — see `OFFER_QUALIFIERS`. Empty is the
     *  common case and means the supplier promised nothing beyond the room itself. */
    offerTerms: string[];
    /** The structural facts bulleted under the name — see `structuralDetails`. */
    roomDetails: Feature[];
    /** The refundable rate's cancellation line, under its row's title; `null` for a
     *  non-refundable one, which the row words from the messages instead. */
    terms: string | null;
    /** The in-room amenities the modal lists when ETG matched no content — see `amenityFeatures`. */
    amenities: Feature[];
    boardPill?: string;
    boardName?: string;
    refundable: boolean;
    /** Already worded — see `cancellationSummary`. */
    cancellation: string;
    /** Per night, in the user's currency. */
    nightly: number;
    /** ETG room-detail content, when the API matched this room to a room-group.
     *  Absent → the modal falls back to `amenities`. */
    content?: RoomContent;
    /** The room's own photographs. Empty → the hotel's shot stands in, labelled as such. */
    photos: string[];
}

/** Tiles in the gallery's thumbnail strip. Past that, the last tile counts the photos left over. */
const STRIP_TILES = 4;

/** The modal photo's back / next buttons, less the edge each one sits on. */
const MODAL_PHOTO_ARROW =
    'absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]';

/**
 * The card's own, smaller arrows. A filled disc rather than the modal's bare glyph: the modal
 * sits on a dark scrim, while these land on whatever the photograph happens to be, and a bare
 * white chevron disappears into a pale sky. 28px is under the 44px touch minimum on its own,
 * so the before: box pads the target out without pushing the discs apart on a narrow card.
 */
const CARD_PHOTO_ARROW =
    'absolute top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center '
    + 'rounded-full bg-slate-900/55 text-white backdrop-blur-[2px] transition-colors hover:bg-slate-900/80 '
    + "before:absolute before:-inset-2 before:content-['']";

/**
 * The room details modal, as the 1a design splits it: the gallery on the left, the room on the
 * right, and the price with Select pinned under the room. Below `md` it is a bottom sheet — the
 * gallery over the room, the price and Select still pinned to the bottom edge.
 *
 * The close button comes first in the DOM, the photos next and Select last, which is the order
 * Tab walks; `trapTab` wraps it at both ends while the modal is open.
 */
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
    /** The hotel photo, shown when the room carries no photos of its own. */
    galleryFallback?: string | null;
}) {
    const tAll = useTranslations();
    const t = useTranslations('property');
    const [lightboxStart, setLightboxStart] = useState<number | null>(null);
    const [active, setActive] = useState(0);
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const photos = card.photos;

    // Focus moves in when the modal opens, and back to whatever opened it when it closes.
    useEffect(() => {
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeRef.current?.focus();
        return () => { if (opener?.isConnected) opener.focus(); };
    }, []);

    useEffect(() => {
        // While the photo viewer is open it owns the keyboard — Escape closes it, the arrows
        // move it — so the modal only takes keys once the viewer is gone.
        const onKey = (e: KeyboardEvent) => {
            if (lightboxStart !== null) return;
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' && photos.length > 1) setActive(i => (i + 1) % photos.length);
            else if (e.key === 'ArrowLeft' && photos.length > 1) setActive(i => (i - 1 + photos.length) % photos.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, lightboxStart, photos.length]);

    /** Tab off either end comes round to the other, so focus never reaches the page behind. */
    const trapTab = (e: React.KeyboardEvent) => {
        if (e.key !== 'Tab' || !dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    const symbol = currencySymbol(currency) || currency;
    const stayNights = Math.max(1, nights ?? 1);
    const total = card.nightly * stayNights;
    const penalties = card.room.cancelPolicy?.cancelPenalties?.filter(p => fmtDate(p.deadline)) ?? [];

    const eyebrow = cn('text-[10px] font-bold tracking-[0.12em] uppercase', palette.modalLabel);
    const contentPalette = { feature: palette.modalText, columnHeading: palette.modalTitle, empty: palette.empty };

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
    /** The key facts under the name — the bed, the party, the size. ETG's bed line, where it
     *  has one, is the better wording of the bed. */
    const facts = bedLine
        ? [{ label: bedLine, icon: BedDouble }, ...card.roomDetails.filter(f => f.icon !== BedDouble)]
        : card.roomDetails;
    const amenityCount = hasRoomContent ? roomContent!.keyFacts.length : card.amenities.length;

    /** The strip shows every photo while they fit, and three plus a "+N" tile once they do not. */
    const thumbs = photos.length > STRIP_TILES ? photos.slice(0, STRIP_TILES - 1) : photos;
    const leftOver = photos.length - thumbs.length;

    return createPortal(
        // A deep scrim rather than a light tint: the page behind is a busy one — photos,
        // a map, prices — and at 45% it still competed with the modal for the eye.
        <div
            data-testid="room-dialog-backdrop"
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/75 md:items-center md:p-4"
            onClick={onClose}
        >
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${card.heading} details`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={trapTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                    // Rounded, like the room cards that open it — the top corners only while it
                    // is a sheet on the bottom edge.
                    'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[18px] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15)] md:rounded-[18px]',
                    'md:grid md:h-[min(680px,calc(100vh-2rem))] md:w-[min(1080px,calc(100vw-2rem))] md:grid-cols-[minmax(0,1.2fr)_minmax(380px,1fr)] md:grid-rows-[minmax(0,1fr)_auto]',
                    palette.modalBg,
                )}
            >
                {/* Where the design's header puts it on desktop; over the photo on the sheet. */}
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label={tAll('trips.cancellationModal.close')}
                    className={cn('absolute top-5 right-5 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors', palette.modalClose)}
                >
                    <X size={16} />
                </button>

                {/* One scroll on the sheet, gallery and room together; on desktop this wrapper
                    dissolves and its two children take the grid's two columns. */}
                <div className="min-h-0 flex-1 overflow-y-auto md:contents">
                    {/* The photo takes the whole column, edge to edge. Its counter and the
                        thumbnails ride its bottom edge on a scrim, as the place cards ride the map. */}
                    <div className={cn('relative h-72 shrink-0 overflow-hidden md:col-start-1 md:row-span-2 md:row-start-1 md:h-auto', palette.imageBg)}>
                        {photos.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setLightboxStart(active)}
                                aria-label={t('rooms.viewRoomPhotos')}
                                className="absolute inset-0 cursor-zoom-in"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img data-testid="room-gallery-main" src={photos[active]} alt="" className="h-full w-full object-cover" />
                            </button>
                        ) : galleryFallback ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={galleryFallback} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                            <div data-testid="room-gallery-placeholder" className="absolute inset-0" />
                        )}

                        {(photos.length > 0 || galleryFallback) && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-linear-to-t from-black/65 via-black/25 to-transparent px-3 pt-16 pb-3">
                                {photos.length > 0 ? (
                                    <span className="self-end rounded-full bg-slate-900/75 px-2 py-[3px] font-mono text-[11px] text-white">
                                        {active + 1} / {photos.length}
                                    </span>
                                ) : (
                                    // Labelled, so the hotel's building is never passed off as the room.
                                    <span className="self-start rounded-full bg-slate-900/75 px-2 py-[3px] text-[11px] text-white">
                                        {t('v2.photoOfProperty')}
                                    </span>
                                )}

                                {photos.length > 1 && (
                                    <div className="pointer-events-auto grid grid-cols-4 gap-2">
                                        {thumbs.map((src, i) => (
                                            <button
                                                key={`${i}-${src}`}
                                                type="button"
                                                onClick={() => setActive(i)}
                                                aria-label={`Photo ${i + 1} of ${photos.length}`}
                                                aria-pressed={i === active}
                                                className={cn(
                                                    'h-16 cursor-pointer overflow-hidden transition-opacity',
                                                    i === active ? 'outline-2 outline-white' : 'opacity-70 hover:opacity-100',
                                                )}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={src} alt="" className="h-full w-full object-cover" />
                                            </button>
                                        ))}
                                        {leftOver > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setLightboxStart(thumbs.length)}
                                                aria-label={`+${leftOver} more photos`}
                                                className={cn(
                                                    'h-16 cursor-pointer bg-black/55 text-[13px] font-semibold text-white backdrop-blur-sm hover:bg-black/70',
                                                    active >= thumbs.length && 'outline-2 outline-white',
                                                )}
                                            >
                                                +{leftOver}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Back and next, at the photo's edges — the same bare chevrons
                            as the banner and the nearby-places strip, held legible on a
                            bright photo by a drop-shadow rather than a plate. They step
                            through every photo, wrapping at the ends, as the arrow keys
                            already did; the strip below follows along. 44px targets, so
                            the glyph can stay slim. Last in the box, so they sit over
                            the zoom button and the scrim rather than under them. */}
                        {photos.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setActive(i => (i - 1 + photos.length) % photos.length)}
                                    aria-label={t('v2.previousPhoto')}
                                    className={cn(MODAL_PHOTO_ARROW, 'left-2')}
                                >
                                    <ChevronLeft size={30} strokeWidth={2.25} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActive(i => (i + 1) % photos.length)}
                                    aria-label={t('v2.nextPhoto')}
                                    className={cn(MODAL_PHOTO_ARROW, 'right-2')}
                                >
                                    <ChevronRight size={30} strokeWidth={2.25} />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col md:col-start-2 md:row-start-1 md:min-h-0">
                        <h3 className={cn('font-display pt-5 pr-5 pl-6 text-[22px] leading-[1.2] font-bold tracking-[-0.02em] md:pr-16', palette.modalTitle)}>
                            {card.heading}
                        </h3>

                        <div className="flex flex-col gap-[18px] px-6 py-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
                            {(facts.length > 0 || bedsExtraSummary) && (
                                <div className="flex flex-col gap-1.5">
                                    {facts.length > 0 && (
                                        <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px]', palette.modalText)}>
                                            {facts.map((f, i) => {
                                                const Icon = f.icon;
                                                return (
                                                    <li key={`${f.label}-${i}`} className="flex items-center gap-1.5">
                                                        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                                                        <span className="capitalize">{f.label}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    {bedsExtraSummary && (
                                        <p className={cn('text-[12px]', palette.empty)}>{bedsExtraSummary}</p>
                                    )}
                                </div>
                            )}

                            {amenityCount > 0 && (
                                <section className="flex flex-col gap-2">
                                    <p className={eyebrow}>{tAll('propertyNav.amenities')}</p>
                                    {hasRoomContent ? (
                                        <KeyFactsRow facts={roomContent!.keyFacts} palette={contentPalette} />
                                    ) : (
                                        <ul className="grid grid-cols-2 gap-2">
                                            {card.amenities.map((feature, i) => (
                                                <FeatureRow key={`${feature.label}-${i}`} feature={feature} palette={palette} />
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            )}

                            {modalSections.length > 0 && (
                                <DetailSectionGrid sections={modalSections} palette={contentPalette} />
                            )}

                            <section className="flex flex-col gap-2">
                                <p className={eyebrow}>{tAll('property.policies.title')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {card.boardPill && <Badge variant="secondary">{card.boardPill}</Badge>}
                                    <Badge variant={card.refundable ? 'success' : 'destructive'}>
                                        {card.refundable ? tAll('property.rooms.freeCancellation') : tAll('property.rooms.nonRefundable')}
                                    </Badge>
                                </div>
                                <p className={cn('text-[12px] leading-[1.5]', palette.empty)}>{card.cancellation}</p>
                                {penalties.length > 0 && (
                                    <ul className={cn('flex flex-col gap-1 text-[12px]', palette.empty)}>
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
                                {card.rate.currency && card.rate.currency !== currency && (
                                    <p className={cn('text-[12px]', palette.empty)}>{`Charged in ${card.rate.currency} at booking.`}</p>
                                )}
                            </section>

                            {additionalInfo && (
                                <section className="flex flex-col gap-2">
                                    <p className={eyebrow}>{t('v2.additionalInfo')}</p>
                                    <p className={cn('text-[13px] leading-[1.5] whitespace-pre-line', palette.modalText)}>{additionalInfo}</p>
                                </section>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pinned: the bottom of the sheet, and the foot of the room column on desktop. */}
                <div className={cn('flex items-center justify-between gap-4 border-t px-6 py-3.5 md:col-start-2 md:row-start-2', palette.modalRule)}>
                    <div className="min-w-0">
                        <p className="flex items-baseline gap-1">
                            <span className={cn('font-mono text-[20px] font-bold', palette.modalTitle)}>
                                {`${symbol}${Math.round(card.nightly).toLocaleString()}`}
                            </span>
                            <span className={cn('text-[12px]', palette.modalLabel)}>{t('rooms.perNight')}</span>
                        </p>
                        {stayNights > 1 && (
                            <p className={cn('text-[12px]', palette.empty)}>
                                {`Total ${symbol}${Math.round(total).toLocaleString()} · ${stayNights} nights`}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        onClick={() => { onSelect({ room: card.room, rate: card.rate }); onClose(); }}
                        aria-pressed={selected}
                        // The card's own Select pill, so the two read as the same button.
                        className={cn('shrink-0 cursor-pointer rounded-full', selected ? cn(palette.selectOn, 'shadow-none') : palette.selectIdle)}
                    >
                        {selected ? 'Selected' : 'Select room'}
                    </Button>
                </div>
            </motion.div>

            {/* Its own layer — clicks inside the viewer (backdrop, close, arrows)
                must not bubble to the modal's `onClick={onClose}` behind it. */}
            {lightboxStart !== null && photos.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                    <Lightbox
                        images={photos}
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
 * One room, as the 2a design lays it out: the photo on the left with its count on it, then
 * the name and its facts with "Room details" across from them, the room's rates as a list of
 * radio rows, and the price with Select at the foot.
 *
 * The rows are the whole point of 2a. Each one is a rate in full — what it comes with, what
 * cancelling costs, what it costs a night — so a reader compares the terms side by side
 * rather than one at a time. Picking a row re-reads the card: the facts, the price at the
 * foot and what Select books all follow it, so the price beside Select is always the price of
 * the row that is lit. Nothing is booked until Select is pressed.
 *
 * `cards` is one `RateCard` per rate, cheapest first, all sharing a heading. The bed can
 * still differ between them ("(twin beds)" against nothing at all), so every rate-specific
 * fact is read off the picked card rather than the first.
 *
 * The photo sits beside the text and fills the card's height. On a card narrower than `@lg`
 * — a phone, or the half-width column on a small laptop — it moves above the text at a fixed,
 * modest height: beside it, the rows would be too narrow for a title, its terms and a price.
 */
function RoomCard({
    cards, image, selectedOfferId, palette, currency, nights, onSelect,
    propertySections, additionalInfo,
}: {
    cards: RateCard[];
    image?: string | null;
    selectedOfferId?: string | null;
    palette: Palette; currency: string; nights?: number | null;
    onSelect: (offer: SelectedOffer) => void;
    propertySections?: DetailSection[];
    additionalInfo?: string;
}) {
    const tAll = useTranslations();
    const t = useTranslations('property');
    /** One radio group per card, so the arrow keys move within this room's rates only. */
    const radioName = useId();
    const [modalOpen, setModalOpen] = useState(false);
    /** The row the reader picked. Null until they pick one — see `card` below. */
    const [pickedOfferId, setPickedOfferId] = useState<string | null>(null);

    /**
     * The rate the card is currently showing: the one picked, else the one already selected
     * for checkout, else the cheapest. Resolved by id rather than index so a re-filter that
     * drops a rate cannot leave the card reading off a different one than it highlights.
     */
    const pickedIdx = cards.findIndex(c => c.rate.offerId === (pickedOfferId ?? selectedOfferId));

    /**
     * A row's title: the board, and then whatever else tells this rate from the others in the
     * card — the bed, the offer terms — when, and only when, it differs between them.
     *
     * One heading can cover rooms the supplier separates only in the parenthetical — ROYAL
     * Hotel Seoul files "no window" and "2 full double beds" under one "Standard room" — and
     * untitled, a reader picks on price and gets the other one. A rate with no board and
     * nothing that differs gets no title; its row leads with its terms instead. ADR-0007.
     */
    const rowTitle = useMemo(() => {
        const varies = (of: (c: RateCard) => string) => new Set(cards.map(of)).size > 1;
        const bed   = varies(c => c.bed ?? '');
        const terms = varies(c => offerTermsKey(c));
        return (c: RateCard) => [
            c.boardName,
            bed   ? c.bed                   : null,
            terms ? c.offerTerms.join(', ') : null,
        ].filter((part): part is string => Boolean(part)).join(' · ') || null;
    }, [cards]);

    const card = cards[pickedIdx >= 0 ? pickedIdx : 0];
    const selected = card.rate.offerId === selectedOfferId;
    const choosable = cards.length > 1;

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
    const photoCount = card.photos.length;
    /** The room's own photographs, the hotel's shot standing in when it has none. */
    const gallery = photoCount ? card.photos : (image ? [image] : []);
    const [photoIdx, setPhotoIdx] = useState(0);
    // Clamped rather than reset: picking another rate chip can swap the card's photos, and an
    // index left past the end of a shorter gallery would blank the image.
    const shownIdx = gallery.length ? Math.min(photoIdx, gallery.length - 1) : 0;
    const photo = gallery[shownIdx];
    const stepPhoto = (delta: number) =>
        setPhotoIdx(i => (Math.min(i, gallery.length - 1) + delta + gallery.length) % gallery.length);
    const symbol = currencySymbol(currency) || currency;
    const price = (c: RateCard) => `${symbol}${Math.round(c.nightly).toLocaleString()}`;

    /** A rate row's inside: the dot (only where there is a choice), the title over its terms,
     *  and the price (only where it is not already the one at the foot). */
    const rowBody = (option: RateCard, on: boolean) => {
        const title = rowTitle(option);
        const terms = option.terms ?? tAll('hotels.rooms.nonRefundable');
        const termsClass = cn('text-[12px]', option.refundable ? palette.positive : palette.feature);
        return (
            <>
                {choosable && (
                    <span aria-hidden className={cn('size-4 shrink-0 rounded-full transition-colors', on ? palette.dotOn : palette.dotOff)} />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {title ? (
                        <>
                            <span className={cn('text-[14px] font-semibold', palette.name)}>{title}</span>
                            <span className={termsClass}>{terms}</span>
                        </>
                    ) : (
                        <span className={cn(termsClass, 'text-[14px] font-semibold')}>{terms}</span>
                    )}
                </span>
                {choosable && (
                    <span className={cn('shrink-0 font-mono text-[15px] font-bold', palette.price)}>{price(option)}</span>
                )}
            </>
        );
    };

    const rowClass = 'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors';

    return (
        <article className={cn('@container overflow-hidden rounded-xl', palette.card)}>
            <div className="flex flex-col @lg:grid @lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Full bleed: no radius and no inset, running to the card's own edges — the top
                    and both sides on a phone, the top, left and bottom beside the text — where it
                    used to sit in the card's padding as a rounded tile. The card's rounded corners
                    and `overflow-hidden` are what round its outer corners now.

                    Beside the text it stretches to the text's height, never past it: the image
                    is absolutely placed, so it cannot push the card taller, and `min-h-60`
                    keeps it from going thin beside a room with one rate. Pressing it opens the
                    room's details, where the gallery is. */}
                <div className={cn('relative h-48 w-full overflow-hidden @lg:h-auto @lg:min-h-60', palette.imageBg)}>
                    {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {photoCount > 0 && (
                        <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={() => setModalOpen(true)}
                            aria-label={t('rooms.viewRoomPhotos')}
                            className="absolute inset-0 cursor-zoom-in"
                        >
                            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-[5px] rounded-full bg-slate-900/75 px-[9px] py-1 text-[11px] text-white">
                                <Images size={12} aria-hidden className="shrink-0" />
                                {t('v2.roomPhotoCount', { count: photoCount })}
                            </span>
                        </button>
                    )}
                    {/* Over the full-bleed button above, so a tap pages the photo instead of
                        opening the modal — hence `stopPropagation`. Always drawn rather than
                        shown on hover: a phone has no hover, and this is mainly for a phone. */}
                    {gallery.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); stepPhoto(-1); }}
                                aria-label={t('v2.previousPhoto')}
                                className={cn(CARD_PHOTO_ARROW, 'left-1.5')}
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} aria-hidden />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); stepPhoto(1); }}
                                aria-label={t('v2.nextPhoto')}
                                className={cn(CARD_PHOTO_ARROW, 'right-1.5')}
                            >
                                <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
                            </button>
                            <span
                                aria-hidden
                                className="absolute right-2 bottom-2.5 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                            >
                                {shownIdx + 1}/{gallery.length}
                            </span>
                        </>
                    )}
                </div>

                {/* The card's padding is the text's alone now. 24px beside the 260px photo puts
                    the text where it started when the photo was 240px inside 20px of padding. */}
                <div className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5 @lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <h4 className={cn('font-display text-[17px] leading-[1.2] font-bold tracking-[-0.02em] @md:text-[22px]', palette.name)}>
                                {card.heading}
                            </h4>
                            {card.roomDetails.length > 0 && (
                                <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]', palette.fact)}>
                                    {card.roomDetails.map((fact, i) => {
                                        const Icon = fact.icon;
                                        return (
                                            <li key={`${fact.label}-${i}`} className="flex items-center gap-1.5 capitalize">
                                                <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                                                {fact.label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        {/* The hit area reaches past the 13px text so a thumb can find it. */}
                        <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={() => setModalOpen(true)}
                            className={cn(
                                "relative shrink-0 cursor-pointer text-[13px] font-semibold whitespace-nowrap underline-offset-2 transition-colors before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline",
                                palette.link,
                            )}
                        >
                            {tAll('hotels.rooms.roomDetails')}
                        </button>
                    </div>

                    {/* Native radios under the drawn dots, so the arrow keys walk the rates and
                        a screen reader hears "radio, 2 of 3" without anything rebuilt by hand. A
                        room sold one way is one plain row: there is no choice to offer. */}
                    {choosable ? (
                        <div
                            role="radiogroup"
                            aria-label={t('v2.rateOptionsFor', { room: card.heading })}
                            className="flex flex-col gap-2"
                        >
                            {cards.map((option) => {
                                const on = option.rate.offerId === card.rate.offerId;
                                return (
                                    <label
                                        key={option.rate.offerId}
                                        className={cn(
                                            rowClass,
                                            'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500',
                                            on ? palette.rateOn : palette.rateOff,
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name={radioName}
                                            value={option.rate.offerId}
                                            checked={on}
                                            onChange={() => setPickedOfferId(option.rate.offerId)}
                                            className="sr-only"
                                        />
                                        {rowBody(option, on)}
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div data-testid="room-rate" className={cn(rowClass, palette.rateOnly)}>
                            {rowBody(card, true)}
                        </div>
                    )}

                    {/* Pinned to the foot, so beside a tall photo the price and Select line up with
                        its bottom edge. Announced when it changes: picking a row reprices the card. */}
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                        <p data-testid="room-card-price" aria-live="polite" className="whitespace-nowrap">
                            <span className={cn('font-mono text-[19px] font-bold @md:text-[22px]', palette.price)}>{price(card)}</span>
                            <span className={cn('text-[12px]', palette.unit)}>{tAll('hotels.perNight')}</span>
                        </p>
                        {/* Only this button picks the rate — the card is not clickable — and the
                            selected state lives on it. */}
                        <button
                            type="button"
                            onClick={() => onSelect({ room: card.room, rate: card.rate })}
                            aria-pressed={selected}
                            className={cn(
                                'h-10 shrink-0 cursor-pointer rounded-full px-5 text-[13px] font-bold whitespace-nowrap transition-[filter,color] @md:h-11 @md:px-7 @md:text-[14px]',
                                selected ? palette.selectOn : palette.selectIdle,
                            )}
                        >
                            {selected ? 'Selected' : 'Select'}
                        </button>
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
    rooms, image, images, hotelAmenities, nights, checkIn, occupancy, currency,
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
            offerTerms: split.offerTerms,
            bed: room.bedType ?? split.bed ?? bedFromName(room.name),
            roomDetails: structural,
            terms: cancellationTerms(rate, checkIn),
            amenities,
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
     * The rooms in reading order, each with every rate it is sold at.
     *
     * One card per *room*, not per rate. Drawn per rate, a room sold two ways was two cards
     * identical but for the price — "Standard Family room" twice over at ₱5,409 and ₱5,506 —
     * which reads as a listing fault rather than as a choice of terms. The rates ride inside
     * the card as radio rows instead, so the difference between them is next to the thing that
     * differs rather than a card away.
     *
     * Grouped *after* filtering, so only rates that survived the filters are placed and a card
     * never offers one the filter excluded. Keyed on the heading because that is what a reader
     * distinguishes rooms by — two supplier room codes with one display name are one room to
     * the person choosing, and `splitRoomName` has already taken the bed off the end.
     *
     * Cheapest room first, and each room's rates cheapest first: the card headlines its first.
     */
    const ordered = useMemo(() => {
        const byRoom = new Map<string, RateCard[]>();
        for (const card of filtered) {
            const key = card.heading;
            const existing = byRoom.get(key);
            if (existing) existing.push(card);
            else byRoom.set(key, [card]);
        }
        const groups = [...byRoom.values()].map((rates) => {
            const cheapestFirst = [...rates].sort((a, b) => a.nightly - b.nightly);
            // One Offer per term-signature. Two that promise the same thing at different
            // prices are not a choice — the dearer is strictly worse, and showing both
            // reproduces the look-alike pair this grouping exists to remove. ADR-0007.
            const bySignature = new Map<string, RateCard>();
            for (const rate of cheapestFirst) {
                const signature = termSignature(rate);
                if (!bySignature.has(signature)) bySignature.set(signature, rate);
            }
            return [...bySignature.values()];
        });
        return groups.sort((a, b) => a[0].nightly - b[0].nightly);
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
                    {paged.map((group, i) => (
                        <RoomCard
                            key={group[0].rate.offerId}
                            cards={group}
                            // Indexed across the whole list, not the page, so a card keeps its
                            // photo when the pager moves. Only reaches the card at all when the
                            // room has none of its own — see `photo` in `RoomCard`.
                            image={images?.length
                                ? images[(safePage * CARDS_PER_PAGE + i) % images.length]
                                : image}
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
