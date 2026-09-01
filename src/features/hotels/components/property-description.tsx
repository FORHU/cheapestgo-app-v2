'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Accessibility, AirVent, ArrowUpDown, Baby, Car, Cigarette, Coffee,
    Dumbbell, PawPrint, Sparkles, Tv, Utensils, WashingMachine,
    Waves, Wifi, type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';
import { cleanSupplierDescription } from '@/features/hotels/lib/clean-description';
import type { AmenityGroup } from '@/features/hotels/types/property.types';

/**
 * How many amenity chips the collapsed section draws — the row the design
 * shows. "See all amenities" only appears when there are more behind it.
 */
const COLLAPSED_AMENITIES = 4;

/**
 * Lines of description shown before "Read more".
 *
 * Supplier copy is one unbroken block of everything they know — voltage, socket
 * types, whether the desk speaks Korean — so a clamp is not a nicety here. Five
 * is what the design leaves standing, and it is about where the useful half of
 * that block ends.
 */
const COLLAPSED_LINES = 5;

/** One eased curve for the whole disclosure, so the list and the chips in it
 *  are never on two different clocks. */
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/**
 * The list's own height, which is the thing that actually has to be smooth:
 * it is a real layout property, so the rule and the description below it
 * travel with it instead of jumping to their new places the instant the
 * chips change.
 */
const CHIP_REVEAL = { duration: 0.42, ease: EASE };
/** The revealed chips, coming up just behind the edge that uncovers them. */
const CHIP_FADE_IN  = { duration: 0.28, ease: EASE, delay: 0.08 };
/** And going out ahead of it, so nothing is still fading when the list closes. */
const CHIP_FADE_OUT = { duration: 0.12, ease: 'linear' as const };

/**
 * The measurement below has to land before the browser paints, or the list
 * shows every chip for a frame on the way in. `useLayoutEffect` is what does
 * that, and React warns about it during SSR — hence the swap.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface PropertyDescriptionProps {
    /** The cheapest nightly rate, in `currency`. Omitted, the price is dropped
     *  and the rating slides into its place. */
    price?: number | null;
    currency?: string;
    /** Guest score out of 10. */
    rating?: number | null;
    /**
     * Front-desk hours, as the supplier words them.
     *
     * The pair is drawn only when at least one arrives — a made-up 3:00 PM is
     * worse than no line at all, since it is the kind of detail a guest plans a
     * flight around.
     */
    checkInTime?: string | null;
    checkOutTime?: string | null;
    /** The supplier's flat amenity list — the fallback when `amenityGroups` is absent. */
    amenities?: string[];
    /**
     * ETG's amenities grouped by category ("Internet", "Parking", …). When present,
     * the chip block draws one labelled `ChipGroup` per group instead of the single
     * flat "Amenities" group.
     */
    amenityGroups?: AmenityGroup[];
    description?: string | null;
    /**
     * Which palette to draw from, for a page whose chrome does not follow the
     * app theme. Defaults to the theme. The property page hardcodes dark, so it
     * passes that in rather than leaving the section to guess.
     */
    tone?: 'light' | 'dark';
    className?: string;
}

/**
 * Every colour the section paints with, picked by tone rather than by a `dark:`
 * variant — the property page hardcodes its own tone, where the variant could
 * only ever resolve one way. Whole class strings on both branches so Tailwind's
 * scanner still finds each one.
 *
 * There is no surface among them, and that is the point: the design draws this
 * straight onto the page ground with no plate, no hairline and no radius. Only
 * the chips are a fill.
 */
function descriptionPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        /** The price, the labels, and the two disclosure links. */
        title: dark ? 'text-white' : 'text-slate-900',
        /** `/night` — a step under the figure it qualifies. */
        muted: dark ? 'text-white/55' : 'text-slate-400',
        /** `rating`, beside the score: quieter than the number, louder than
         *  `/night`, which is what separates the three weights on that line. */
        soft:  dark ? 'text-white/85' : 'text-slate-600',
        /** The write-up, deliberately the quietest thing in the section. */
        body:  dark ? 'text-white/55' : 'text-slate-500',
        chip:     dark ? 'bg-white/[0.07] text-white/90' : 'bg-slate-100 text-slate-700',
        chipIcon: dark ? 'text-white/60' : 'text-slate-400',
        link:     dark ? 'text-white hover:text-white/70' : 'text-slate-900 hover:text-slate-600',
        /** The hairline between what the stay comes with and what the supplier
         *  says about it. */
        rule:     dark ? 'bg-white/10' : 'bg-slate-200',
    };
}

type Palette = ReturnType<typeof descriptionPalette>;

/**
 * An icon per amenity, matched on the words suppliers actually use.
 *
 * First match wins, so the specific patterns lead: "Free Wi-Fi in all areas"
 * has to reach `Wifi` before anything looser claims it.
 *
 * There is deliberately no fallback. The design draws "24 hour reception" as a
 * bare chip beside three that carry icons, so an icon here means "we have a
 * glyph that actually says this", not "every chip needs something on its left".
 * A tick on the unmatched ones would say nothing the label does not, four times
 * over.
 */
const AMENITY_ICONS: [RegExp, LucideIcon][] = [
    [/elevator|lift/i,                             ArrowUpDown],
    [/wi-?fi|internet|broadband|network/i,         Wifi],
    [/smok/i,                                      Cigarette],
    [/park|garage|valet/i,                         Car],
    [/pool|swim|spa|sauna|beach/i,                 Waves],
    [/gym|fitness|workout/i,                       Dumbbell],
    [/restaurant|dining|meal|room service/i,       Utensils],
    [/breakfast|coffee|\bbar\b|caf[eé]/i,          Coffee],
    [/air ?condition|climate|\ba\/?c\b|heating/i,  AirVent],
    [/laundry|washing|dry ?clean|iron/i,           WashingMachine],
    [/\bpets?\b|dog|animal/i,                      PawPrint],
    [/accessib|wheelchair|disabled|barrier/i,      Accessibility],
    [/\btv\b|television|satellite|streaming/i,     Tv],
    [/family|child|kid|baby|crib/i,                Baby],
    [/clean|housekeep|hygien|sanit/i,              Sparkles],
];

function amenityIcon(name: string): LucideIcon | null {
    for (const [pattern, icon] of AMENITY_ICONS) {
        if (pattern.test(name)) return icon;
    }
    return null;
}

/**
 * `"15:00"` → `"3:00 PM"`.
 *
 * Suppliers send either the 24-hour clock or an already-worded string, and
 * there is no telling which until it arrives, so anything that is not `HH:mm`
 * is passed straight through rather than mangled into a guess.
 */
function formatStayTime(raw?: string | null): string | null {
    const value = raw?.trim();
    if (!value) return null;

    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return value;

    const hours = Number(match[1]);
    if (hours > 23) return value;

    const suffix = hours < 12 ? 'AM' : 'PM';
    return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${suffix}`;
}

// ─── Disclosure link ──────────────────────────────────────────────────────────

/** The section's two "there is more behind this" links, drawn identically. */
function Disclosure({
    label, expanded, palette, onClick,
}: {
    label: string; expanded: boolean; palette: Palette; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            className={cn('cursor-pointer text-[18px] font-bold transition-colors', palette.link)}
        >
            {label}
        </button>
    );
}

// ─── Chip group ───────────────────────────────────────────────────────────────

/**
 * Which of a hotel's "amenities" are really house rules.
 *
 * Suppliers return one flat list with the lift and the smoking policy side by
 * side, but they are not the same kind of fact: an amenity is something the
 * stay gives you, a policy is something it asks of you. Mixed together the
 * chips read as a list of features with two traps hidden in it.
 *
 * Matched on the words rather than on any code, because the list arrives as
 * free text — see `otvCodeToLabel` upstream, which has already turned whatever
 * the supplier sent into a label.
 */
const POLICY_AMENITY =
    /\bsmok|\bpets?\b|\bchild|\binfant|\bage\b|deposit|passport|cancellation|\bpolic|\brules?\b|curfew|quiet hours|\bpart(y|ies)\b|\bevents?\b|\ballowed\b|not permitted|prohibit|\brequired\b|on request|surcharge|extra bed|minimum stay/i;

/**
 * The amenities nearly every hotel has — Wi-Fi, air conditioning, a private
 * bathroom with toiletries, a TV.
 *
 * The "General Amenities" row shows the ones of these the hotel actually
 * lists, drawn from the *whole* amenity set rather than from any one ETG
 * category. It leads with what a guest already assumes is there, and leaves
 * the hotel's more particular facilities — a garden, a terrace, a ski room —
 * to the room-detail modal.
 */
const GENERAL_AMENITY =
    /wi-?fi|internet|broadband|air ?condition|\ba\/?c\b|climate control|heating|toiletr|toilet paper|\bshower\b|\bbath\b|bathroom|hair ?dry|\btowels?\b|\btv\b|television|\bdesk\b|wardrobe|closet|\bsafe\b|telephone|\blinens?\b|\bsoap\b|shampoo|slippers?|bathrobe|non-?smoking/i;

function splitAmenities(list: string[]): { facilities: string[]; policies: string[] } {
    const facilities: string[] = [];
    const policies: string[] = [];
    for (const item of list) {
        (POLICY_AMENITY.test(item) ? policies : facilities).push(item);
    }
    return { facilities, policies };
}

/**
 * A labelled group of chips that opens and closes.
 *
 * Extracted so the amenities and the policies can be two of these rather than
 * one list rendered twice — each needs its own open state and its own measured
 * heights, and sharing either would have one group opening the other.
 */
function ChipGroup({
    label, items, moreLabel, lessLabel, palette, reduceMotion, className,
    disclosure = true, compact = false,
}: {
    /** Omitted for the amenities/rules row, which the design draws as two
     *  unlabelled pill groups rather than two labelled sections. */
    label?: string;
    items: string[];
    moreLabel: string;
    lessLabel: string;
    palette: Palette;
    reduceMotion: boolean | null;
    className?: string;
    /** `false` for a short, fixed list (the hotel's general amenities): every
     *  chip always shown, no measurement, no "View more". */
    disclosure?: boolean;
    /** Smaller pills that keep each label on one line — for a capped list that
     *  needs to sit tight. */
    compact?: boolean;
}) {
    const [showAll, setShowAll] = useState(false);

    /**
     * The two heights the list moves between: the bottom of the fourth chip,
     * and the bottom of the last one.
     *
     * Measured rather than derived, because the list wraps: how many rows four
     * chips occupy depends on how long their labels are and how wide the column
     * is, and both change. Reading it off the fourth chip's own box is the only
     * thing that stays right.
     *
     * Every chip is rendered either way and the extras are clipped, which is
     * what lets this animate at all — the chips already on screen never move,
     * so there is no reflow to smooth over, only a height to open.
     */
    const listRef = useRef<HTMLUListElement | null>(null);
    const [heights, setHeights] = useState<{ collapsed: number; full: number } | null>(null);

    useIsomorphicLayoutEffect(() => {
        const el = listRef.current;
        if (!el || !disclosure) return;

        const measure = () => {
            const chips = Array.from(el.children) as HTMLElement[];
            const last = chips[COLLAPSED_AMENITIES - 1];
            const full = el.scrollHeight;
            const collapsed = last ? last.offsetTop + last.offsetHeight : full;
            // Same numbers, same object: the observer below fires on the height
            // animation itself, and a fresh object each time would re-render
            // every frame of it.
            setHeights(prev =>
                prev && prev.collapsed === collapsed && prev.full === full
                    ? prev
                    : { collapsed, full });
        };

        measure();
        // Re-measures when the column changes width and the chips rewrap.
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [items]);

    if (items.length === 0) return null;

    return (
        <div className={className}>
            {label && (
                <p className={cn('mb-3 text-[13px] font-bold tracking-[0.12em] uppercase', palette.muted)}>
                    {label}
                </p>
            )}

            {/* The disclosure is a height, not a reflow. Every chip is always in
                the list and the extras are clipped, so the four already on
                screen do not move at all — opening it only uncovers what was
                behind the edge.

                That the height is real matters as much as that it is animated: a
                `layout` transform would slide the list's own box while whatever
                follows snapped straight to its new place.

                A plain element with a CSS transition, not `motion.ul` with
                `animate` — framer-motion's `animate` silently never wrote a
                `height` to this element (verified: the identical value applied
                via `style` takes immediately, `animate` never did), so the list
                sat at its full, unclamped content height forever while only the
                chips' own opacity fade — a separate `motion.li` below — actually
                worked. The chips still get their fade from framer-motion; only
                the list's own height moved off it. */}
            <ul
                ref={listRef}
                // `relative`, so a chip's `offsetTop` is measured against this
                // list rather than against whatever happens to be positioned
                // above it.
                className={cn('relative flex flex-wrap gap-2', disclosure && 'overflow-hidden')}
                style={disclosure ? {
                    height: heights ? (showAll ? heights.full : heights.collapsed) : undefined,
                    transition: reduceMotion ? 'none' : `height ${CHIP_REVEAL.duration}s cubic-bezier(${EASE.join(',')})`,
                } : undefined}
            >
                {items.map((item, i) => {
                    const Icon = amenityIcon(item);
                    const clipped = disclosure && !showAll && i >= COLLAPSED_AMENITIES;
                    return (
                        <motion.li
                            key={item}
                            // Clipped rather than unmounted — but still hidden
                            // from a screen reader, or the button offering to
                            // show them would be offering what it already read out.
                            aria-hidden={clipped || undefined}
                            initial={false}
                            animate={{ opacity: clipped ? 0 : 1 }}
                            transition={reduceMotion
                                ? { duration: 0 }
                                : (clipped ? CHIP_FADE_OUT : CHIP_FADE_IN)}
                            className={cn(
                                'inline-flex items-center rounded-full',
                                palette.chip,
                                compact
                                    ? 'gap-2 px-3.5 py-1.5 text-[13px] whitespace-nowrap sm:text-[13.5px]'
                                    : 'gap-3 px-6 py-3 text-[16px] sm:text-[17px]',
                            )}
                        >
                            {Icon && (
                                <Icon
                                    size={compact ? 14 : 17}
                                    strokeWidth={1.75}
                                    className={cn('shrink-0', palette.chipIcon)}
                                />
                            )}
                            {item}
                        </motion.li>
                    );
                })}
            </ul>

            {disclosure && items.length > COLLAPSED_AMENITIES && (
                <div className="mt-3">
                    <Disclosure
                        label={showAll ? lessLabel : moreLabel}
                        expanded={showAll}
                        palette={palette}
                        onClick={() => setShowAll((v) => !v)}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function PropertyDescription({
    price, currency = 'USD', rating, checkInTime, checkOutTime,
    amenities = [], amenityGroups, description, tone, className,
}: PropertyDescriptionProps) {
    const { theme } = useTheme();
    const palette = descriptionPalette(tone ?? theme);


    /**
     * The write-up, with the supplier facts block trimmed and its run-on
     * sections split back apart — see `cleanSupplierDescription`. Memoised
     * because the clamp measurement below re-runs on every resize and this
     * should not run with it.
     */
    const body = useMemo(() => cleanSupplierDescription(description), [description]);
    /** Honoured rather than assumed: the chips move a lot of the panel at
     *  once, which is exactly what someone asking for less motion means. */
    const reduceMotion = useReducedMotion();
    const [expanded, setExpanded] = useState(false);

    /**
     * The panel draws one short "General Amenities" group and one
     * "Rules & Policies" group.
     *
     * General Amenities: the near-universal comforts — Wi-Fi, air conditioning,
     * a bathroom with toiletries — picked out of the whole amenity set by
     * `GENERAL_AMENITY`, capped at five. If the supplier's wording matches none
     * of them, fall back to the hotel's ETG "General" category so the row is
     * never empty. The full per-category list belongs in the room-detail modal.
     * Rules & Policies: house rules ("Pets not allowed", curfews) peeled by
     * `splitAmenities` off the *whole* amenity set, since ETG files those under
     * category groups of their own (Pets, Kids, …), not under General.
     */
    const { facilities, policies } = useMemo(() => {
        const allFlat = amenityGroups?.length
            ? Array.from(new Set(amenityGroups.flatMap((g) => g.amenities)))
            : amenities;

        const nonPolicy = splitAmenities(allFlat).facilities;
        const universal = nonPolicy.filter((a) => GENERAL_AMENITY.test(a));

        const general = amenityGroups?.find((g) => /general/i.test(g.groupName));
        const fallback = general?.amenities.length
            ? splitAmenities(Array.from(new Set(general.amenities))).facilities
            : nonPolicy;

        // Both groups: capped at five, compact pills, no "View more" — see the
        // ChipGroup props below.
        return {
            facilities: (universal.length ? universal : fallback).slice(0, 5),
            policies:   splitAmenities(allFlat).policies.slice(0, 5),
        };
    }, [amenityGroups, amenities]);

    /**
     * Whether the clamp is actually cutting anything off.
     *
     * Measured rather than assumed: plenty of stays come back with two lines of
     * description, and "Read more" over a paragraph that is already whole is a
     * link that does nothing. Only measured while collapsed — expanded, the box
     * is its own full height and the answer would always be "no", which would
     * take the link away mid-read and strand the reader in the long copy.
     */
    const bodyRef = useRef<HTMLParagraphElement | null>(null);
    const [overflowing, setOverflowing] = useState(false);
    useEffect(() => {
        const el = bodyRef.current;
        if (!el || expanded) return;
        const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
        measure();
        // Re-measures on a resize, where the same copy reflows to a different
        // number of lines and can cross the clamp in either direction.
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [body, expanded]);

    const inTime  = formatStayTime(checkInTime);
    const outTime = formatStayTime(checkOutTime);
    const hasTimes = Boolean(inTime || outTime);

    const hasPrice = typeof price === 'number' && price > 0;
    const hasRating = typeof rating === 'number' && rating > 0;
    const hasChips = facilities.length > 0 || policies.length > 0;

    // Nothing to say — no section, rather than an empty one.
    if (!hasPrice && !hasRating && !hasTimes && !hasChips && !body) return null;

    // An unknown code has no symbol, so it prints as the code itself.
    const symbol = currencySymbol(currency) || currency;

    return (
        <section className={className}>
            {/* ── Head ─────────────────────────────────────────────────────────
                The rate on the left, IN / OUT held against the right edge of
                the same line, and the amenities/rules pair sharing one row
                beneath both — the wireframe's layout exactly: hours share the
                rate's own line rather than sitting above or beside the chips. */}
            {(hasPrice || hasRating || hasTimes) && (
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                    {(hasPrice || hasRating) && (
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            {hasPrice && (
                                <>
                                    {/* Symbol and digits are separate type, as
                                        drawn: the symbol a size down, so the
                                        number carries the line alone. */}
                                    <span className={cn('text-[36px] font-bold sm:text-[42px]', palette.title)}>
                                        {symbol}
                                    </span>
                                    <span className={cn('-ml-1.5 text-[42px] font-bold tracking-[-0.02em] sm:text-[50px]', palette.title)}>
                                        {Math.round(price).toLocaleString()}
                                    </span>
                                    <span className={cn('text-[21px] sm:text-[24px]', palette.muted)}>/night</span>
                                </>
                            )}
                            {hasRating && (
                                <span className={cn('text-[22px] sm:text-[25px]', palette.soft)}>
                                    <b className={cn('font-bold', palette.title)}>{rating.toFixed(1)}</b> rating
                                </span>
                            )}
                        </div>
                    )}

                    {hasTimes && (
                        // A description list, not two spans: these are
                        // labelled values, and that is what a screen reader
                        // should hear.
                        <dl className={cn('shrink-0 text-right text-[18px] leading-[1.5]', palette.soft)}>
                            {inTime && (
                                <div className="flex justify-end gap-2">
                                    <dt className={cn('font-bold', palette.title)}>CHECK-IN</dt>
                                    <dd>{inTime}</dd>
                                </div>
                            )}
                            {outTime && (
                                <div className="flex justify-end gap-2">
                                    <dt className={cn('font-bold', palette.title)}>OUT</dt>
                                    <dd>{outTime}</dd>
                                </div>
                            )}
                        </dl>
                    )}
                </div>
            )}

            {/* Amenities and rules, side by side in one row, each under its
                own label — the wireframe's two labelled pill groups.

                A grid, not a flex row: amenities routinely runs to twenty-odd
                chips against three or four rules, and a flex row sizes each
                item off its own content first — the long list claims the
                whole line before the short one is ever considered, so it
                wraps to a line of its own beneath instead of sitting beside
                it. A grid hands each side a fixed half regardless of how much
                either is carrying. Single column below `sm`, where two halves
                would each be too narrow to read a chip on. */}
            {hasChips && (
                <div className={cn('grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2', (hasTimes || hasPrice || hasRating) && 'mt-6')}>
                    <ChipGroup
                        label="General Amenities"
                        items={facilities}
                        moreLabel="View more"
                        lessLabel="View less"
                        palette={palette}
                        reduceMotion={reduceMotion}
                        className="min-w-0"
                        disclosure={false}
                        compact
                    />
                    <ChipGroup
                        label="Rules & Policies"
                        items={policies}
                        moreLabel="View more"
                        lessLabel="View less"
                        palette={palette}
                        reduceMotion={reduceMotion}
                        className="min-w-0"
                        disclosure={false}
                        compact
                    />
                </div>
            )}

            {/* ── Description ──────────────────────────────────────────────── */}
            {body && (
                <>
                    {/* The rule the design draws under the amenities. Only when
                        there is something above it to divide from — on a stay
                        with no rate, no hours and no amenities it would be a
                        line under nothing. */}
                    {(hasPrice || hasRating || hasTimes || hasChips) && (
                        <div className={cn('mt-6 h-px w-full', palette.rule)} />
                    )}
                    <p
                        ref={bodyRef}
                        // `whitespace-pre-line` so the paragraph breaks the
                        // cleaner recovers actually render. One <p> rather
                        // than several, because the clamp below is a property
                        // of a single element — split into three paragraphs it
                        // would clamp each of them to five lines instead of the
                        // description as a whole.
                        className={cn('mt-6 text-[18px] leading-[1.6]', palette.body)}
                        // The clamp as a style rather than a `line-clamp-*`
                        // utility: it has to come off entirely when expanded,
                        // and toggling between two utilities leaves whichever
                        // one Tailwind ordered last winning both states.
                        style={expanded ? undefined : {
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: COLLAPSED_LINES,
                            overflow: 'hidden',
                        }}
                    >
                        {body}
                    </p>

                    {(overflowing || expanded) && (
                        <div className="mt-3">
                            <Disclosure
                                label={expanded ? 'Read less' : 'Read more'}
                                expanded={expanded}
                                palette={palette}
                                onClick={() => setExpanded((v) => !v)}
                            />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
