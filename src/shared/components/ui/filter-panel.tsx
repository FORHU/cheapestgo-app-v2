'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

/**
 * The results sidebar's materials, shared by the hotel and flight panels so a
 * selected row, a section label and the collapse handle look the same whichever
 * results page you are on.
 */

/**
 * The accordion slide.
 *
 * A tween rather than the spring the sidebar column uses: this animates to
 * `height: auto`, which framer-motion resolves by measuring the content, and a
 * spring overshoots that measurement — with the box clipped, the overshoot reads
 * as the rows springing past their own container and back. 220ms also matches
 * the chevron's own rotation, which is already a tween at that duration.
 */
const SECTION_SLIDE = {
    duration: 0.22,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

/**
 * Every colour a panel paints with, picked by tone rather than by a `dark:`
 * variant — the map view forces its own tone, under which `dark:` can only ever
 * resolve one way (see `HotelFilters`' `tone` prop).
 *
 * Whole class strings on both branches, never interpolated fragments, so
 * Tailwind's scanner still finds each one.
 */
export function filtersPalette(tone: 'light' | 'dark') {
    const dark = tone === 'dark';
    return {
        /** The panel's plate. The light one carries the lift; the dark one is
         *  already separated from its ground by value alone. */
        panel:   dark ? 'bg-slate-900' : 'bg-white shadow-sm',
        heading: dark ? 'text-white' : 'text-slate-900',
        icon:    dark ? 'text-white' : 'text-slate-700',
        /** Section labels and the chevron beside them. */
        muted:   dark ? 'text-slate-400' : 'text-slate-500',
        reset:   dark ? 'text-slate-400' : 'text-slate-500',
        /** Body copy inside a section — the price row's two labels. */
        body:    dark ? 'text-white/90' : 'text-slate-700',
        /**
         * A selected row — the brand gradient, the same as the cards' price and
         * book chips, so "this one is on" looks the same everywhere in the view.
         */
        rowOn:   'bg-linear-to-r from-blue-600 to-cyan-500 text-white',
        /** Unselected. */
        rowIdle: dark ? 'text-white/90 hover:bg-white/8' : 'text-slate-700 hover:bg-slate-100',
        /** A row whose on-state is drawn by a mark inside it, not by its fill — see `FilterCheckRow`. */
        rowPlain: dark ? 'text-white/90 hover:bg-white/8' : 'text-slate-700 hover:bg-slate-100',
        /** The empty check mark and the switch's off track. */
        mark:    dark ? 'border-white/30' : 'border-slate-300',
        switchOff: dark ? 'bg-white/20' : 'bg-slate-200',
        /** A typed field — price, time, hours. A step darker than the panel, as the search bar's field is. */
        field:   dark
            ? 'border-white/10 bg-[#020617] text-white placeholder:text-white/40 [color-scheme:dark]'
            : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400',
        track:     dark ? 'bg-white/20' : 'bg-slate-200',
        trackFill: 'bg-linear-to-r from-blue-600 to-cyan-500',
        /** Each thumb carries the whole gradient — a thumb is too small to show a slice of it. */
        thumb:
            '[&::-webkit-slider-thumb]:bg-linear-to-r [&::-webkit-slider-thumb]:from-blue-600 [&::-webkit-slider-thumb]:to-cyan-500 ' +
            '[&::-moz-range-thumb]:bg-linear-to-r [&::-moz-range-thumb]:from-blue-600 [&::-moz-range-thumb]:to-cyan-500',
        handle: dark ? 'bg-white/25 text-white' : 'bg-slate-300/90 text-slate-800',
        /** A field's validation message, and the edge of the field it is about. */
        error:       dark ? 'text-rose-300' : 'text-rose-600',
        fieldError:  dark ? 'border-rose-400' : 'border-rose-500',
    };
}

export type FiltersPalette = ReturnType<typeof filtersPalette>;

// ─── Section ──────────────────────────────────────────────────────────────────

export function FilterSection({
    label, open, onToggle, palette, children, onReset, resetLabel,
}: {
    label: string; open: boolean; onToggle: () => void; palette: FiltersPalette; children: React.ReactNode;
    /** Undo this section alone. Offered only while it has something to undo. */
    onReset?: () => void;
    resetLabel?: string;
}) {
    return (
        <div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-1 text-left"
                >
                    <ChevronUp
                        size={16}
                        strokeWidth={1.75}
                        className={cn(
                            'shrink-0 transition-transform duration-200',
                            palette.muted,
                            !open && 'rotate-180',
                        )}
                    />
                    <span className={cn('text-[13px] tracking-[0.13em] uppercase', palette.muted)}>
                        {label}
                    </span>
                </button>
                {onReset && (
                    <button
                        type="button"
                        onClick={onReset}
                        className={cn('shrink-0 pr-1 text-[12px] underline-offset-2 hover:underline', palette.reset)}
                    >
                        {resetLabel}
                    </button>
                )}
            </div>

            {/* `initial={false}` because every section starts open: without it
                the panel would animate itself apart on first paint. */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SECTION_SLIDE}
                        // Clips the rows to the collapsing box. Without it they
                        // stay drawn at full height and simply slide up over the
                        // section below.
                        style={{ overflow: 'hidden' }}
                    >
                        {/* The top margin belongs to the *inner* box. On the
                            animated one it would survive `height: 0` and leave a
                            14px gap under every closed section. */}
                        {/* 34px rows on a 42px pitch, as drawn. */}
                        <div className="mt-[14px] flex flex-col gap-2">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

/**
 * One selectable row. `right` is the trailing detail — a count, a provider's
 * fare type — dimmed against the label.
 *
 * `pressed` is for rows that toggle independently (an airline, a fare type);
 * rows that pick one of a set (a sort order) leave it off, since the gradient
 * already says which one is chosen.
 */
export function FilterRow({
    label, active, palette, onClick, right, pressed,
}: {
    label: React.ReactNode; active: boolean; palette: FiltersPalette; onClick: () => void;
    right?: React.ReactNode; pressed?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            className={cn(
                'flex h-[34px] w-full items-center justify-between gap-3 rounded-full pr-4 pl-[26px] text-left text-[15px] transition-colors',
                active ? palette.rowOn : palette.rowIdle,
            )}
        >
            <span className="min-w-0 truncate">{label}</span>
            {right != null && (
                <span className={cn('shrink-0 text-[12px]', active ? 'opacity-90' : 'opacity-60')}>{right}</span>
            )}
        </button>
    );
}

/**
 * A row in a checklist — every option ticked until the traveller narrows it.
 *
 * The tick carries the state rather than the row's fill: a list that starts
 * fully ticked would otherwise open as a wall of gradient.
 */
export function FilterCheckRow({
    label, checked, palette, onToggle, right,
}: {
    label: React.ReactNode; checked: boolean; palette: FiltersPalette; onToggle: () => void; right?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onToggle}
            className={cn(
                'flex h-[34px] w-full items-center gap-3 rounded-full pr-4 pl-[18px] text-left text-[15px] transition-colors',
                palette.rowPlain,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
                    checked ? `border-transparent ${palette.rowOn}` : palette.mark,
                )}
            >
                {checked && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {right != null && <span className="shrink-0 text-[12px] opacity-60">{right}</span>}
        </button>
    );
}

/** A labelled on/off row — "Select all airlines", "Refundable". */
export function FilterSwitch({
    label, checked, palette, onChange,
}: {
    label: string; checked: boolean; palette: FiltersPalette; onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 px-1">
            <span className={cn('text-[15px]', palette.body)}>{label}</span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                    checked ? palette.rowOn : palette.switchOff,
                )}
            >
                <span
                    className={cn(
                        'mt-0.5 inline-block size-4 rounded-full bg-white shadow transition-transform duration-200',
                        checked ? 'translate-x-[18px]' : 'translate-x-0.5',
                    )}
                />
            </button>
        </div>
    );
}

// ─── Typed field ──────────────────────────────────────────────────────────────

/** A field's pill in the panel — a typed one, and a dropdown beside it (the flight times). */
export const FILTER_FIELD_CLASS =
    'h-9 min-w-0 rounded-full border px-3 text-[14px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

/**
 * A value the traveller can type, committed on Enter or on leaving the field —
 * never per keystroke, or a price of 1,200 would filter at 1, 12 and 120 on the
 * way. What is committed is normalised and written back, so the field always
 * shows what is applied; a draft that does not parse is put back.
 */
export function FilterField({
    value, format, parse, normalize, onCommit, palette, className, ...inputProps
}: {
    value: number;
    format: (n: number) => string;
    parse: (text: string) => number | null;
    normalize: (n: number) => number;
    onCommit: (n: number) => void;
    palette: FiltersPalette;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'>) {
    const shown = format(value);
    const [draft, setDraft] = useState(shown);

    // Follow the slider, and resets, while the field is not being typed into.
    useEffect(() => setDraft(shown), [shown]);

    const commit = () => {
        const parsed = parse(draft);
        if (parsed === null) {
            setDraft(shown);
            return;
        }
        const next = normalize(parsed);
        setDraft(format(next));
        onCommit(next);
    };

    return (
        <input
            {...inputProps}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                }
            }}
            className={cn(
                FILTER_FIELD_CLASS,
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                palette.field,
                className,
            )}
        />
    );
}

// ─── Range slider ─────────────────────────────────────────────────────────────

/**
 * The design's two-handle range. Two native range inputs stacked on one track:
 * the inputs themselves are pointer-transparent so the lower one doesn't
 * swallow clicks meant for the upper, and only the thumbs opt back in.
 *
 * When the low handle is near the top of the track both thumbs land on the same
 * spot, so the low input is lifted above the high one there — otherwise the
 * high input covers it and the range can never be widened again.
 */
export function RangeSlider({
    min, max, low, high, palette, onChange, lowLabel, highLabel,
}: {
    min: number; max: number; low: number; high: number;
    palette: FiltersPalette;
    onChange: (low: number, high: number) => void;
    lowLabel: string;
    highLabel: string;
}) {
    const span = Math.max(1, max - min);
    const step = Math.max(1, Math.round(span / 100));
    const lowPct = ((low - min) / span) * 100;
    const highPct = ((high - min) / span) * 100;

    const thumb =
        '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none ' +
        '[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] ' +
        '[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:rounded-full ' +
        '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:border-0 ' +
        '[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] ' +
        '[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full ' +
        palette.thumb;

    const input =
        'pointer-events-none absolute inset-0 h-[18px] w-full appearance-none bg-transparent outline-none';

    // A range input only stops on whole steps from `min`, so the far end of the
    // track can sit short of `max` — and a filter bounded there drops the dearest
    // results while the handle reads as wide open. Within a step of either end
    // is that end.
    const snap = (v: number) => (v - step < min ? min : v + step > max ? max : v);

    return (
        <div className="relative h-[18px] px-1">
            {/* Track */}
            <div className={cn('absolute top-1/2 right-1 left-1 h-1.5 -translate-y-1/2 rounded-full', palette.track)}>
                <div
                    className={cn('absolute h-full rounded-full', palette.trackFill)}
                    style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
                />
            </div>

            <input
                type="range"
                aria-label={lowLabel}
                min={min} max={max} step={step} value={low}
                onChange={(e) => onChange(Math.min(snap(Number(e.target.value)), high), high)}
                className={cn(input, thumb)}
                style={{ zIndex: lowPct > 80 ? 5 : 3 }}
            />
            <input
                type="range"
                aria-label={highLabel}
                min={min} max={max} step={step} value={high}
                onChange={(e) => onChange(low, Math.max(snap(Number(e.target.value)), low))}
                className={cn(input, thumb)}
                style={{ zIndex: 4 }}
            />
        </div>
    );
}

/** How long typing has to pause before a price field applies itself. */
export const PRICE_FIELD_SETTLE_MS = 600;

type PriceSide = 'low' | 'high';
const shown = (v: number) => String(Math.round(v));
type PriceProblem = 'empty' | 'order';

/**
 * The slider's two ends as fields, for a budget a person already has in mind.
 *
 * Digits only, so a negative or a letter cannot be typed in the first place. A field applies
 * itself once typing pauses, or at once on Enter or on leaving it — not on every keystroke,
 * which would judge a `3` on its way to `300` against the minimum and flash an error at
 * somebody still typing. A field the panel cannot use keeps what was typed and says why, and
 * the results keep the last range that made sense until it is put right.
 *
 * A value past either end of the range is accepted; the caller clamps it, as it does the
 * slider, and the field shows the clamped value once it is left.
 */
export function PriceRangeFields({
    low, high, symbol, palette, onChange, labels,
}: {
    low: number; high: number;
    symbol: string;
    palette: FiltersPalette;
    onChange: (low: number, high: number) => void;
    labels: {
        min: string; max: string;
        minFull: string; maxFull: string;
        empty: string; minAboveMax: string; maxBelowMin: string;
    };
}) {
    const id = useId();
    const [draft, setDraft] = useState({ low: shown(low), high: shown(high) });
    const [editing, setEditing] = useState<PriceSide | null>(null);
    const [problem, setProblem] = useState<{ side: PriceSide; kind: PriceProblem } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Follow the slider and the reset, except in a field being typed in or one showing an error.
    useEffect(() => {
        setDraft((d) => ({
            low:  editing === 'low'  || problem?.side === 'low'  ? d.low  : shown(low),
            high: editing === 'high' || problem?.side === 'high' ? d.high : shown(high),
        }));
    }, [low, high, editing, problem]);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const commit = (side: PriceSide, text: string) => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        if (text === '') return setProblem({ side, kind: 'empty' });
        const value = Number(text);
        if (side === 'low' ? value > high : value < low) return setProblem({ side, kind: 'order' });
        setProblem(null);
        if (side === 'low') onChange(value, high); else onChange(low, value);
    };

    const type = (side: PriceSide, raw: string) => {
        const text = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        setDraft((d) => ({ ...d, [side]: text }));
        if (problem?.side === side) setProblem(null);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(side, text), PRICE_FIELD_SETTLE_MS);
    };

    const message = problem && (
        problem.kind === 'empty' ? labels.empty
            : problem.side === 'low' ? labels.minAboveMax : labels.maxBelowMin
    );

    const field = (side: PriceSide) => {
        const inputId = `${id}-${side}`;
        const invalid = problem?.side === side;
        return (
            <div className="min-w-0 flex-1">
                <label htmlFor={inputId} className={cn('mb-1.5 block text-[13px]', palette.muted)} aria-hidden>
                    {side === 'low' ? labels.min : labels.max}
                </label>
                <div
                    className={cn(
                        'flex h-11 items-center gap-1 rounded-xl border px-3 transition-colors focus-within:ring-2 focus-within:ring-blue-500/60',
                        palette.field,
                        invalid && palette.fieldError,
                    )}
                >
                    <span className={cn('shrink-0 text-[15px]', palette.muted)} aria-hidden>{symbol}</span>
                    <input
                        id={inputId}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        enterKeyHint="done"
                        aria-label={side === 'low' ? labels.minFull : labels.maxFull}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? `${id}-error` : undefined}
                        value={draft[side]}
                        onFocus={(e) => { setEditing(side); e.currentTarget.select(); }}
                        onChange={(e) => type(side, e.target.value)}
                        onBlur={(e) => { commit(side, e.target.value); setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(side, e.currentTarget.value); } }}
                        // 16px, not the panel's 15: iOS zooms the page into any field set smaller.
                        className="w-full min-w-0 bg-transparent text-[16px] tabular-nums outline-none"
                    />
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex items-end gap-2">
                {field('low')}
                <span className={cn('pb-3 text-[15px]', palette.muted)} aria-hidden>–</span>
                {field('high')}
            </div>
            <p id={`${id}-error`} role="alert" className={cn('mt-1.5 min-h-[18px] text-[13px]', palette.error)}>
                {message}
            </p>
        </div>
    );
}
