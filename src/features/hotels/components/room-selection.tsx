'use client';

import React, { useMemo, useState } from 'react';
import {
    AirVent, Bath, Bed, Building2, Check, Coffee, Dog, Maximize2, Refrigerator,
    ShieldCheck, Sparkles, Tv, UtensilsCrossed, Users, Wifi, Wind, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';
import { convertCurrency } from '@/shared/lib/currency';
import { SECTION_HEADING } from '@/shared/lib/layout';
import type { RateRow, RoomOption } from '@/features/hotels/types/property.types';

/**
 * Feature rows a collapsed card shows before "View more" — the four the design
 * draws above its board line.
 */
const COLLAPSED_FEATURES = 4;

/**
 * What each board code is called on the card.
 *
 * A code that is not in here falls back to whatever the supplier called it, and
 * failing that draws no board row at all: "No Breakfast Included" is a claim
 * about the rate, and an unknown code is not evidence for it.
 */
const BOARD_LABELS: Record<string, string> = {
    RO: 'No Breakfast Included',
    OB: 'No Breakfast Included',
    SC: 'No Breakfast Included',
    BB: 'Breakfast Included',
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

/**
 * What a refundable rate's cancellation row says.
 *
 * The deadline is the one date that genuinely differs between two rates on the
 * same room — the stay's own dates are the search's, identical for everything
 * on the page — so a bare "Free cancellation" flattens the very thing that
 * tells two otherwise identical offers apart.
 *
 * Falls back to the bare phrase when the supplier sent no deadline, or sent one
 * that will not parse: the rate is still refundable, and that is worth saying
 * even when we cannot say until when.
 */
function cancellationLabel(rate: RateRow): string {
    const raw = rate.cancellationDeadline;
    if (!raw) return 'Free cancellation';

    const deadline = new Date(raw);
    if (Number.isNaN(deadline.getTime())) return 'Free cancellation';

    return `Free cancellation until ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
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
     * their own — see `roomFeatures`.
     */
    hotelAmenities?: string[];
    /**
     * Nights in the stay. Supplier prices cover the *whole stay*, so this is
     * what turns one into the per-night figure the card prints. Absent, the
     * price is shown as it arrived.
     */
    nights?: number | null;
    /** The currency to price in — the user's, not the supplier's. */
    currency: string;
    /** The chosen rate, by `offerId`; a room can offer several. */
    selectedOfferId: string | null;
    onSelect: (offer: SelectedOffer) => void;
    /** Which palette to draw from. Defaults to the app theme; the property page
     *  hardcodes its own dark and passes it in. */
    tone?: 'light' | 'dark';
    className?: string;
    id?: string;
}

function roomPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        heading: dark ? 'text-white' : 'text-slate-900',
        /**
         * The card's plate. Cool rather than neutral, as drawn — it is what
         * separates the stack from the black page behind it without a border.
         */
        card:     dark ? 'bg-[#131A24]' : 'bg-white shadow-sm',
        /** Selection, as a ring rather than a fill: the card carries a photo,
         *  and a fill would have to fight it. */
        cardOn:   dark ? 'ring-1 ring-white/45' : 'ring-1 ring-slate-900',
        name:     dark ? 'text-white' : 'text-slate-900',
        feature:  dark ? 'text-white/55' : 'text-slate-500',
        price:    dark ? 'text-white' : 'text-slate-900',
        unit:     dark ? 'text-white/45' : 'text-slate-400',
        imageBg:  dark ? 'bg-white/[0.06]' : 'bg-slate-100',
        /**
         * The pills, and they run the opposite way round to the rest of the app
         * — which is deliberate, and is what the design draws.
         *
         * White is the *available* state and dark is the *taken* one: the
         * filters you could switch to are the bright pills, the one already
         * applied is the recessive outlined one, and "Select Room" is bright
         * until the rate is yours. So brightness reads as "you can press this",
         * not as "this is on".
         */
        pillIdle: dark ? 'bg-white text-[#111111] hover:bg-white/85' : 'bg-slate-900 text-white hover:bg-slate-700',
        pillOn:   dark
            ? 'border border-white/45 bg-white/[0.04] text-white'
            : 'border border-slate-300 bg-white text-slate-900',
        link:     dark ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900',
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

/**
 * The rows under a room's name: what you sleep on, how many of you, how big it
 * is, then what is in the room. The board and cancellation lines are not among
 * them — those belong to the *rate* rather than the room, and the card draws
 * them last.
 *
 * `hotelAmenities` is a fallback, not an addition: read only when the rate
 * itself listed nothing, and then only through `IN_ROOM_AMENITY`. Most
 * suppliers describe amenities once, at the property, and return bare rates —
 * so without this the card is a name and a price. It stays a weaker claim than
 * a rate's own list: "the hotel has air conditioning" is not quite "this room
 * does".
 */
function roomFeatures(room: RoomOption, bedHint: string | null, hotelAmenities: string[] = []): Feature[] {
    const out: Feature[] = [];

    const bed = room.bedType ?? bedHint ?? bedFromName(room.name);
    if (bed)               out.push({ label: bed, icon: Bed });
    if (room.maxOccupancy) out.push({ label: `Up to ${room.maxOccupancy} guests`, icon: Users });
    if (room.size)         out.push({ label: `${room.size} m²`, icon: Maximize2 });

    const amenities = room.amenities?.length
        ? room.amenities
        : hotelAmenities.filter(a => IN_ROOM_AMENITY.test(a));
    for (const amenity of amenities) {
        out.push({ label: amenity, icon: featureIcon(amenity) });
    }
    return out;
}

/** What the rate calls its board, by code first and by the supplier's own
 *  wording second. */
function boardLabel(rate: RateRow): string | undefined {
    return (rate.boardCode ? BOARD_LABELS[rate.boardCode] : undefined) ?? rate.boardName ?? undefined;
}

function FeatureRow({ feature, palette }: { feature: Feature; palette: Palette }) {
    const Icon = feature.icon;
    return (
        <li className={cn('flex items-center gap-2 text-[15px]', palette.feature)}>
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="min-w-0 truncate">{feature.label}</span>
        </li>
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
    features: Feature[];
    board?: string;
    refundable: boolean;
    /** Already worded — see `cancellationLabel`. */
    cancellation: string;
    /** Per night, in the user's currency. */
    nightly: number;
}

function RoomRateCard({
    card, image, selected, palette, currency, onSelect,
}: {
    card: RateCard; image?: string | null; selected: boolean;
    palette: Palette; currency: string; onSelect: (offer: SelectedOffer) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const shown = expanded ? card.features : card.features.slice(0, COLLAPSED_FEATURES);
    const hasMore = card.features.length > COLLAPSED_FEATURES;
    // The hotel's photo, not the room's: `roomImages` are the banner's
    // pagination now, where a set of them can actually be looked through.
    const photo = image;
    const symbol = currencySymbol(currency) || currency;
    const pick = () => onSelect({ room: card.room, rate: card.rate });

    return (
        <div
            onClick={pick}
            className={cn(
                'flex min-h-[150px] cursor-pointer overflow-hidden rounded-[16px] transition-shadow',
                palette.card,
                selected && palette.cardOn,
            )}
        >
            {/* Photo — flush into the card's own corners.

                Square on its own account, and rounded only where the card
                rounds it: `overflow-hidden` on the card above clips this to
                the top-left and bottom-left radius and leaves the right side
                straight, where the panel carries on. A radius set here would
                round all four and leave the two outer corners showing the
                plate through the gap. */}
            <div className={cn('relative w-[27%] max-w-[190px] min-w-[92px] shrink-0 self-stretch overflow-hidden', palette.imageBg)}>
                {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                )}
            </div>

            {/* Name + features */}
            <div className="flex min-w-0 flex-1 flex-col py-3 pl-4">
                <h4 className={cn('truncate text-[20px] font-medium', palette.name)}>{card.heading}</h4>

                <ul className="mt-3 flex flex-col gap-1.5">
                    {shown.map((feature, i) => (
                        <FeatureRow key={`${feature.label}-${i}`} feature={feature} palette={palette} />
                    ))}

                    {/* Free cancellation, when the rate offers it. Not among the
                        design's rows, but "Refundable" is one of the filters
                        above it, and a filter whose result the card cannot show
                        is one you have to take on trust. */}
                    {card.refundable && (
                        <FeatureRow feature={{ label: card.cancellation, icon: ShieldCheck }} palette={palette} />
                    )}

                    {/* The board line is last, and "View more" rides it — the
                        design hangs the link off the end of that row rather than
                        under the list. With no board to print, the link takes
                        the row on its own. */}
                    {(card.board || hasMore) && (
                        <li className={cn('flex items-center gap-3 text-[15px]', palette.feature)}>
                            {card.board && (
                                <span className="flex min-w-0 items-center gap-2">
                                    <UtensilsCrossed size={17} strokeWidth={1.75} className="shrink-0" />
                                    <span className="truncate">{card.board}</span>
                                </span>
                            )}
                            {hasMore && (
                                <button
                                    type="button"
                                    // The card is a selection target, so the link
                                    // has to keep its click to itself.
                                    onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                                    aria-expanded={expanded}
                                    className={cn('shrink-0 cursor-pointer transition-colors', palette.link)}
                                >
                                    {expanded ? 'View less' : 'View more'}
                                </button>
                            )}
                        </li>
                    )}
                </ul>
            </div>

            {/* Price + action */}
            <div className="flex shrink-0 flex-col items-end justify-between py-3 pr-4 pl-4">
                <p className="whitespace-nowrap">
                    <span className={cn('text-[28px] font-bold', palette.price)}>
                        {symbol}{Math.round(card.nightly).toLocaleString()}
                    </span>
                    <span className={cn('text-[14px]', palette.unit)}>/night</span>
                </p>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); pick(); }}
                    aria-pressed={selected}
                    className={cn(
                        'cursor-pointer rounded-full px-8 py-3 text-[15px] font-medium whitespace-nowrap transition-colors',
                        selected ? palette.pillOn : palette.pillIdle,
                    )}
                >
                    {selected ? 'Selected' : 'Select Room'}
                </button>
            </div>
        </div>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function RoomSelection({
    rooms, image, hotelAmenities, nights, currency, selectedOfferId, onSelect,
    tone, className, id,
}: RoomSelectionProps) {
    const { theme } = useTheme();
    const palette = roomPalette(tone ?? theme);
    const [filter, setFilter] = useState<RoomFilter>('all');

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
        const features = roomFeatures(room, split.bed, hotelAmenities);
        return ratesOf(room).map((rate) => ({
            room,
            rate,
            heading: split.name,
            features,
            board: boardLabel(rate),
            refundable: isRefundable(rate),
            cancellation: cancellationLabel(rate),
            // Supplier prices cover the whole stay; the card prints a night.
            nightly: convertCurrency(rate.price, rate.currency || 'USD', currency) / Math.max(1, nights ?? 1),
        }));
    }), [rooms, hotelAmenities, currency, nights]);

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

    if (rooms.length === 0) return null;

    return (
        <section id={id} className={className}>
            <h2 className={cn(SECTION_HEADING, palette.heading)}>Available Rooms</h2>

            <div className="mt-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        aria-pressed={filter === f.value}
                        className={cn(
                            'cursor-pointer rounded-full px-8 py-3 text-[16px] font-medium transition-colors',
                            filter === f.value ? palette.pillOn : palette.pillIdle,
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="mt-4 flex flex-col gap-3">
                {filtered.map((card) => (
                    <RoomRateCard
                        key={`${card.room.id}-${card.rate.offerId}`}
                        card={card}
                        image={image}
                        currency={currency}
                        selected={card.rate.offerId === selectedOfferId}
                        palette={palette}
                        onSelect={onSelect}
                    />
                ))}

                {filtered.length === 0 && (
                    <p className={cn('py-8 text-center text-[18px]', palette.empty)}>
                        No rooms match that rate. Try another filter.
                    </p>
                )}
            </div>
        </section>
    );
}
