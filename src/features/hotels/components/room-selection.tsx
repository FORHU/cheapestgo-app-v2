'use client';

import React, { useMemo, useState } from 'react';
import {
    AirVent, Bath, Bed, Building2, Check, Coffee, Dog, Maximize2, Refrigerator,
    Sparkles, Tv, UtensilsCrossed, Users, Wifi, Wind, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';
import { SECTION_HEADING } from '@/shared/lib/layout';
import type { RoomOption } from './room-list';

/**
 * Feature rows a collapsed card shows before "View more" — the four the design
 * draws above its board line.
 */
const COLLAPSED_FEATURES = 4;

/** Board codes that include a morning meal, which is what the filter asks. */
const BOARD_WITH_BREAKFAST = ['BB', 'HB', 'FB', 'AI'];

/**
 * What each board code is called on the card.
 *
 * A code that is not in here — including none at all — draws no board row.
 * "No Breakfast Included" is a claim about the rate, and an unknown code is not
 * evidence for it; the row is left off rather than guessed at.
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

export type RoomFilter = 'all' | 'breakfast' | 'refundable' | 'non-refundable';

const FILTERS: { value: RoomFilter; label: string }[] = [
    { value: 'all',            label: 'All' },
    { value: 'breakfast',      label: 'Breakfast Included' },
    { value: 'refundable',     label: 'Refundable' },
    { value: 'non-refundable', label: 'Non-refundable' },
];

interface RoomSelectionProps {
    rooms: RoomOption[];
    /**
     * The plate behind each room.
     *
     * Suppliers return rates, not room photography — `RoomOption` has no image
     * — so this is the hotel's own, handed down by the page. One picture across
     * the cards is what the design draws, and it is the honest version too: a
     * different hotel photo per card would read as a picture *of that room*.
     */
    image?: string | null;
    /**
     * The hotel's own amenity list, as a fallback for rates that carry none
     * of their own — see `roomFeatures`. Left off, a bare rate simply shows
     * fewer rows.
     */
    hotelAmenities?: string[];
    selectedRoomId: string | null;
    onSelect: (id: string) => void;
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
         * until the room is yours. So brightness reads as "you can press this",
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
    [/bed|twin|double|queen|king|sofa/i,           Bed],
    [/view|balcony|terrace|window|city|sea|ocean/i, Building2],
    [/wi-?fi|internet|broadband/i,                  Wifi],
    [/air ?condition|climate|\ba\/?c\b/i,           AirVent],
    [/heat|fan|ventilat/i,                          Wind],
    [/bath|shower|toilet|towel|toiletr/i,           Bath],
    [/\btv\b|television|satellite|streaming/i,      Tv],
    [/fridge|minibar|refrigerat|kettle/i,           Refrigerator],
    [/breakfast|coffee|tea\b/i,                     Coffee],
    [/guest|occupan|person|adult/i,                 Users],
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
 * The bed, read out of the room's own name.
 *
 * A fallback for the common case where a supplier sends no `bedType` but has
 * written it into the name anyway — "Double Room, 1 king bed", "Twin Room".
 * The count is kept where it is given and assumed to be one where it is not,
 * which is what "Twin Room" means.
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
 * Used to sift the hotel's own list when a rate arrives without one — see
 * `roomFeatures`. A pool or a car park is the hotel's; Wi-Fi, the air
 * conditioning and the television are on the other side of the room door, so
 * they are the ones worth repeating on a room card.
 */
const IN_ROOM_AMENITY =
    /wi-?fi|internet|air ?condition|climate|\ba\/?c\b|heating|television|\btv\b|minibar|fridge|refrigerat|safe\b|bathroom|shower|\bbath\b|balcony|terrace|view\b|hair ?dry|desk|kettle|coffee|tea\b|soundproof|iron|towel|toiletr|slipper|bathrobe|wardrobe|closet|linen|telephone/i;

/**
 * The rows under a room's name, in the order the design lists them: what you
 * sleep on, how many of you, how big it is, then what is in the room. The board
 * line is not among them — the card draws that last, since it is the row "View
 * more" sits beside.
 *
 * `hotelAmenities` is a fallback, not an addition: it is read only when the
 * rate itself listed nothing, and then only through `IN_ROOM_AMENITY`. Most
 * suppliers describe amenities once, at the property, and return bare rates —
 * so without this the card is a name and a price, which is the design's rows
 * missing rather than the design's rows empty. It stays a weaker claim than a
 * rate's own list: "the hotel has air conditioning" is not quite "this room
 * does".
 */
function roomFeatures(room: RoomOption, hotelAmenities: string[] = []): Feature[] {
    const out: Feature[] = [];

    const bed = room.bedType ?? bedFromName(room.name);
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

function FeatureRow({ feature, palette }: { feature: Feature; palette: Palette }) {
    const Icon = feature.icon;
    return (
        <li className={cn('flex items-center gap-2 text-[11px]', palette.feature)}>
            <Icon size={12} strokeWidth={1.75} className="shrink-0" />
            <span className="min-w-0 truncate">{feature.label}</span>
        </li>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RoomCard({
    room, image, hotelAmenities, selected, palette, onSelect,
}: {
    room: RoomOption; image?: string | null; hotelAmenities?: string[]; selected: boolean;
    palette: Palette; onSelect: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const features = roomFeatures(room, hotelAmenities);
    const shown = expanded ? features : features.slice(0, COLLAPSED_FEATURES);
    const board = room.boardType ? BOARD_LABELS[room.boardType] : undefined;
    const hasMore = features.length > COLLAPSED_FEATURES;

    const symbol = currencySymbol(room.currency) || room.currency;

    return (
        <div
            onClick={() => onSelect(room.id)}
            className={cn(
                'flex min-h-[96px] cursor-pointer gap-3 rounded-[12px] p-[3px] transition-shadow',
                palette.card,
                selected && palette.cardOn,
            )}
        >
            {/* Photo — near flush to the card's edge, as drawn: the plate is a
                frame around it rather than a panel it sits on. */}
            <div className={cn('relative w-[27%] max-w-[190px] min-w-[92px] shrink-0 self-stretch overflow-hidden rounded-[10px]', palette.imageBg)}>
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-cover" />
                )}
            </div>

            {/* Name + features */}
            <div className="flex min-w-0 flex-1 flex-col py-2 pl-2">
                <h4 className={cn('truncate text-[14px] font-medium', palette.name)}>{room.name}</h4>

                <ul className="mt-2 flex flex-col gap-[3px]">
                    {shown.map((feature, i) => (
                        <FeatureRow key={`${feature.label}-${i}`} feature={feature} palette={palette} />
                    ))}

                    {/* The board line is always last, and "View more" rides it —
                        the design hangs the link off the end of that row rather
                        than under the list. With no board code to print, the
                        link takes the row on its own. */}
                    {(board || hasMore) && (
                        <li className={cn('flex items-center gap-3 text-[11px]', palette.feature)}>
                            {board && (
                                <span className="flex min-w-0 items-center gap-2">
                                    <UtensilsCrossed size={12} strokeWidth={1.75} className="shrink-0" />
                                    <span className="truncate">{board}</span>
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
            <div className="flex shrink-0 flex-col items-end justify-between py-2 pr-3">
                <p className="whitespace-nowrap">
                    <span className={cn('text-[20px] font-bold', palette.price)}>
                        {symbol}{Math.round(room.price).toLocaleString()}
                    </span>
                    <span className={cn('text-[10px]', palette.unit)}>/night</span>
                </p>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect(room.id); }}
                    aria-pressed={selected}
                    className={cn(
                        'cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors',
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
    rooms, image, hotelAmenities, selectedRoomId, onSelect, tone, className, id,
}: RoomSelectionProps) {
    const { theme } = useTheme();
    const palette = roomPalette(tone ?? theme);
    const [filter, setFilter] = useState<RoomFilter>('all');

    const filtered = useMemo(() => {
        if (filter === 'all') return rooms;
        if (filter === 'breakfast') {
            return rooms.filter(r => BOARD_WITH_BREAKFAST.includes(r.boardType ?? ''));
        }
        if (filter === 'refundable') return rooms.filter(r => r.refundableTag === 'RFN');
        // Non-refundable is everything that is not marked refundable: suppliers
        // are reliable about flagging RFN and patchy about flagging its
        // opposite, so testing for NRFN alone would drop most of them.
        return rooms.filter(r => r.refundableTag !== 'RFN');
    }, [rooms, filter]);

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
                            'cursor-pointer rounded-full px-4 py-1.5 text-[11.5px] font-medium transition-colors',
                            filter === f.value ? palette.pillOn : palette.pillIdle,
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="mt-4 flex flex-col gap-3">
                {filtered.map((room) => (
                    <RoomCard
                        key={room.id}
                        room={room}
                        image={image}
                        hotelAmenities={hotelAmenities}
                        selected={room.id === selectedRoomId}
                        palette={palette}
                        onSelect={onSelect}
                    />
                ))}

                {filtered.length === 0 && (
                    <p className={cn('py-8 text-center text-[12.5px]', palette.empty)}>
                        No rooms match that rate. Try another filter.
                    </p>
                )}
            </div>
        </section>
    );
}
