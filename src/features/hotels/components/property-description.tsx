'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    Accessibility, AirVent, ArrowUpDown, Baby, Car, Cigarette, Coffee,
    Dumbbell, PawPrint, Sparkles, Tv, Utensils, WashingMachine,
    Waves, Wifi, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/components/ThemeContext';
import { currencySymbol } from '@/shared/lib/format';

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
    amenities?: string[];
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
            className={cn('cursor-pointer text-[13px] font-bold transition-colors', palette.link)}
        >
            {label}
        </button>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function PropertyDescription({
    price, currency = 'USD', rating, checkInTime, checkOutTime,
    amenities = [], description, tone, className,
}: PropertyDescriptionProps) {
    const { theme } = useTheme();
    const palette = descriptionPalette(tone ?? theme);

    const [showAllAmenities, setShowAllAmenities] = useState(false);
    const [expanded, setExpanded] = useState(false);

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
    }, [description, expanded]);

    const inTime  = formatStayTime(checkInTime);
    const outTime = formatStayTime(checkOutTime);
    const hasTimes = Boolean(inTime || outTime);

    const shownAmenities = showAllAmenities ? amenities : amenities.slice(0, COLLAPSED_AMENITIES);
    const hasPrice = typeof price === 'number' && price > 0;
    const hasRating = typeof rating === 'number' && rating > 0;

    // Nothing to say — no section, rather than an empty one.
    if (!hasPrice && !hasRating && !hasTimes && amenities.length === 0 && !description) return null;

    // An unknown code has no symbol, so it prints as the code itself.
    const symbol = currencySymbol(currency) || currency;

    return (
        <section className={className}>
            {/* ── Head ─────────────────────────────────────────────────────────
                The rate over the chips on the left, the desk's hours held
                against the right edge.

                `items-end`, so the hours sit on the chips' baseline rather than
                the price's — the left column is two rows tall and the design
                lands the pair against the bottom of it. */}
            {(hasPrice || hasRating || hasTimes || amenities.length > 0) && (
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                    <div className="min-w-0">
                        {(hasPrice || hasRating) && (
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                {hasPrice && (
                                    <>
                                        {/* Symbol and digits are separate type,
                                            as drawn: the symbol a size down, so
                                            the number carries the line alone. */}
                                        <span className={cn('text-[26px] font-bold sm:text-[30px]', palette.title)}>
                                            {symbol}
                                        </span>
                                        <span className={cn('-ml-1.5 text-[30px] font-bold tracking-[-0.02em] sm:text-[36px]', palette.title)}>
                                            {Math.round(price).toLocaleString()}
                                        </span>
                                        <span className={cn('text-[15px] sm:text-[17px]', palette.muted)}>/night</span>
                                    </>
                                )}
                                {hasRating && (
                                    <span className={cn('text-[16px] sm:text-[18px]', palette.soft)}>
                                        <b className={cn('font-bold', palette.title)}>{rating.toFixed(1)}</b> rating
                                    </span>
                                )}
                            </div>
                        )}

                        {amenities.length > 0 && (
                            <ul className={cn('flex flex-wrap gap-2', (hasPrice || hasRating) && 'mt-4')}>
                                {shownAmenities.map((amenity) => {
                                    const Icon = amenityIcon(amenity);
                                    return (
                                        <li
                                            key={amenity}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] sm:text-[12px]',
                                                palette.chip,
                                            )}
                                        >
                                            {Icon && <Icon size={12} strokeWidth={1.75} className={cn('shrink-0', palette.chipIcon)} />}
                                            {amenity}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {hasTimes && (
                        // A description list, not two rows of spans: these are
                        // labelled values, and that is what a screen reader
                        // should hear. Left-aligned inside its own box and the
                        // box held right — the labels line up with each other,
                        // which is what the design draws; right-aligning the
                        // text instead would stagger `IN` off `OUT`.
                        <dl className={cn('shrink-0 text-[15px] leading-[1.5] sm:text-[17px]', palette.soft)}>
                            {inTime && (
                                <div className="flex gap-2">
                                    <dt className={cn('font-bold', palette.title)}>IN</dt>
                                    <dd>{inTime}</dd>
                                </div>
                            )}
                            {outTime && (
                                <div className="flex gap-2">
                                    <dt className={cn('font-bold', palette.title)}>OUT</dt>
                                    <dd>{outTime}</dd>
                                </div>
                            )}
                        </dl>
                    )}
                </div>
            )}

            {/* Under the whole head rather than inside the left column: the
                design runs it along the section's own left edge, below the
                hours as well as below the chips. */}
            {amenities.length > COLLAPSED_AMENITIES && (
                <div className="mt-3">
                    <Disclosure
                        label={showAllAmenities ? 'Show fewer amenities' : 'See all amenities'}
                        expanded={showAllAmenities}
                        palette={palette}
                        onClick={() => setShowAllAmenities((v) => !v)}
                    />
                </div>
            )}

            {/* ── Description ──────────────────────────────────────────────── */}
            {description && (
                <>
                    {/* The rule the design draws under the amenities. Only when
                        there is something above it to divide from — on a stay
                        with no rate, no hours and no amenities it would be a
                        line under nothing. */}
                    {(hasPrice || hasRating || hasTimes || amenities.length > 0) && (
                        <div className={cn('mt-6 h-px w-full', palette.rule)} />
                    )}
                    <p
                        ref={bodyRef}
                        className={cn('mt-6 text-[12.5px] leading-[1.6]', palette.body)}
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
                        {description}
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
