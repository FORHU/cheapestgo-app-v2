'use client';

import { useTranslations } from 'next-intl';
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { currencySymbol } from '@/shared/lib/format';
import { useTheme } from '@/shared/components/ThemeContext';
import {
    filtersPalette, FilterSection, FilterRow, FilterCheckRow, FilterSwitch, FilterField, RangeSlider,
    type FiltersPalette,
} from '@/shared/components/ui/filter-panel';
import type { FlightOffer } from '@/shared/types';
import {
    DAY_END_MINUTE, DAY_START_MINUTE, DEFAULT_FLIGHT_FILTERS,
    activeFilterCount, filterBounds, offerAirline, offerArrivalAirport, offerIsRefundable, offerMatchesStops,
    type FlightFilterState, type FlightSortBy,
} from '../lib/filter-offers';

export { DEFAULT_FLIGHT_FILTERS, type FlightFilterState } from '../lib/filter-offers';

interface FlightFiltersProps {
    filters: FlightFilterState;
    onChange: (f: Partial<FlightFilterState>) => void;
    /** Shown as the header's Reset link once any filter is off its default. */
    onReset?: () => void;
    /** All unfiltered offers — the source of every bound, list and count. */
    allOffers?: FlightOffer[];
    /** Rendered as the handle on the panel's right edge when provided. */
    onCollapse?: () => void;
    className?: string;
}

/** How many options a list shows before it asks to be expanded. */
const COLLAPSED_LIST_LENGTH = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function minutesToClock(minute: number): string {
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** "08:30" into 510; anything that is not a clock time on one day into null. */
function clockToMinutes(text: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h > 23 || min > 59 ? null : h * 60 + min;
}

/** A typed number, or null for an empty or unreadable field. */
function parseNumber(text: string): number | null {
    if (text.trim() === '') return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

/**
 * A checklist with a select-all switch above it — v1's airline and arrival-airport
 * lists.
 *
 * Empty selection means "no restriction", which is also what every box ticked
 * means. The switch writes whichever of the two the traveller asked for, so the
 * list and the filter never disagree about what an untouched panel does.
 */
function CheckList({
    options, selected, onChange, counts, selectAllLabel, palette,
}: {
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    counts: Record<string, number>;
    selectAllLabel: string;
    palette: FiltersPalette;
}) {
    const t = useTranslations('flights.filtersPanel');
    const [expanded, setExpanded] = useState(false);

    const allSelected = selected.length === 0 || selected.length === options.length;
    const shown = expanded ? options : options.slice(0, COLLAPSED_LIST_LENGTH);

    const toggleOne = (option: string) => {
        // An untouched list reads as "everything"; the first untick has to start from
        // that, or unticking one airline would silently select only that airline.
        const base = selected.length === 0 ? options : selected;
        const next = base.includes(option) ? base.filter((o) => o !== option) : [...base, option];
        onChange(next.length === options.length ? [] : next);
    };

    return (
        <>
            <FilterSwitch
                label={selectAllLabel}
                checked={allSelected}
                palette={palette}
                onChange={(on) => onChange(on ? [] : [options[0]])}
            />
            {shown.map((option) => (
                <FilterCheckRow
                    key={option}
                    label={option}
                    checked={selected.length === 0 || selected.includes(option)}
                    right={counts[option] ?? 0}
                    palette={palette}
                    onToggle={() => toggleOne(option)}
                />
            ))}
            {options.length > COLLAPSED_LIST_LENGTH && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className={cn('inline-flex items-center gap-1 self-center text-[12px] hover:underline', palette.muted)}
                >
                    <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
                    {expanded ? t('showLess') : t('showAll')}
                </button>
            )}
        </>
    );
}

/**
 * The flight results sidebar: v1's filters (`components/flights/filters.tsx` in
 * cheapest-go-app) drawn from the hotel panel's materials — see `filter-panel.tsx`
 * — so the two results pages read as one product. The rules behind every control
 * live in `lib/filter-offers.ts`.
 */
export function FlightFilters({ filters, onChange, onReset, allOffers = [], onCollapse, className }: FlightFiltersProps) {
    const t = useTranslations('flights.filtersPanel');
    const tAll = useTranslations();
    const { theme } = useTheme();
    const palette = filtersPalette(theme);
    const [open, setOpen] = useState({
        sort: true, airlines: true, stops: true, price: true, times: true, duration: true, airports: true, provider: true,
    });
    const section = (k: keyof typeof open) => () => setOpen((s) => ({ ...s, [k]: !s[k] }));
    const reset = t('reset');

    const bounds = useMemo(() => filterBounds(allOffers), [allOffers]);
    const currency = allOffers[0]?.price?.currency ?? 'USD';

    // Counts come from the unfiltered set, so an option never reads as empty just
    // because another filter is currently hiding its results.
    const counts = useMemo(() => {
        const airlines: Record<string, number> = {};
        const airports: Record<string, number> = {};
        const providers: Record<string, number> = {};
        for (const offer of allOffers) {
            const airline = offerAirline(offer);
            if (airline) airlines[airline] = (airlines[airline] ?? 0) + 1;
            const airport = offerArrivalAirport(offer);
            if (airport) airports[airport] = (airports[airport] ?? 0) + 1;
            if (offer.provider) providers[offer.provider] = (providers[offer.provider] ?? 0) + 1;
        }
        return {
            airlines, airports, providers,
            stops: ([0, 1, 2] as const).map((s) => allOffers.filter((o) => offerMatchesStops(o, s)).length),
            refundable: allOffers.filter(offerIsRefundable).length,
        };
    }, [allOffers]);

    const dirty = filters.sortBy !== DEFAULT_FLIGHT_FILTERS.sortBy || activeFilterCount(filters) > 0;

    const priceRange = filters.priceRange ?? bounds.price;
    const departureWindow = filters.departureWindow ?? [DAY_START_MINUTE, DAY_END_MINUTE];
    const arrivalWindow = filters.arrivalWindow ?? [DAY_START_MINUTE, DAY_END_MINUTE];
    const maxDuration = filters.maxDurationMinutes ?? bounds.duration[1];
    const hasPriceSpread = bounds.price[1] > bounds.price[0];
    const hasDurationSpread = bounds.duration[1] > bounds.duration[0];
    const providers = Object.keys(counts.providers).sort();

    const sortOptions: { value: FlightSortBy; label: string }[] = [
        { value: 'price', label: t('cheapestFirst') },
        { value: 'duration', label: t('fastestFirst') },
        { value: 'departure', label: t('earliestDeparture') },
    ];
    const stopOptions: { value: 0 | 1 | 2; label: string }[] = [
        { value: 0, label: t('direct') },
        { value: 1, label: t('oneStop') },
        { value: 2, label: t('twoStopsPlus') },
    ];

    /** A day window's two ends as clock-time fields, each held on its own side of the other. */
    const timeWindow = (label: string, window: [number, number], onWindow: (next: [number, number]) => void) => (
        <div className="px-1">
            <span className={cn('mb-1.5 block text-[15px]', palette.body)}>{label}</span>
            <div className="flex items-center gap-1.5">
                {([0, 1] as const).map((end) => (
                    <React.Fragment key={end}>
                        {end === 1 && <span className={palette.muted}>–</span>}
                        <FilterField
                            type="time"
                            palette={palette}
                            aria-label={t(end === 0 ? 'rangeFrom' : 'rangeTo', { label })}
                            value={window[end]}
                            format={minutesToClock}
                            parse={clockToMinutes}
                            normalize={(v) => (end === 0 ? clamp(v, DAY_START_MINUTE, window[1]) : clamp(v, window[0], DAY_END_MINUTE))}
                            onCommit={(v) => onWindow(end === 0 ? [v, window[1]] : [window[0], v])}
                            className="w-full flex-1 px-2.5 text-[13px]"
                        />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

    return (
        <div className={cn('relative', className)}>
            <aside className={cn('w-full overflow-hidden rounded-[20px]', palette.panel)}>
                {/* Scrolls once the sections outgrow the viewport, without a bar —
                    on a panel this narrow it was mostly a seam. */}
                <div className="no-scrollbar max-h-[calc(100dvh-7rem)] overflow-y-auto px-[18px] py-6">
                    <div className="flex items-center gap-2.5 px-1">
                        <SlidersHorizontal size={17} strokeWidth={1.75} className={cn('shrink-0', palette.icon)} />
                        <span className={cn('text-[17px]', palette.heading)}>{tAll('flights.results.filters')}</span>
                        {dirty && onReset && (
                            <button
                                type="button"
                                onClick={onReset}
                                className={cn('ml-auto text-[12px] underline-offset-2 hover:underline', palette.reset)}
                            >
                                {reset}
                            </button>
                        )}
                    </div>

                    <div className="mt-7 space-y-6">
                        {/* ── Sort ── */}
                        <FilterSection label={t('sortBy')} open={open.sort} onToggle={section('sort')} palette={palette}>
                            {sortOptions.map((opt) => (
                                <FilterRow
                                    key={opt.value}
                                    label={opt.label}
                                    active={filters.sortBy === opt.value}
                                    palette={palette}
                                    onClick={() => onChange({ sortBy: opt.value })}
                                />
                            ))}
                        </FilterSection>

                        {/* ── Airlines ── */}
                        {bounds.airlines.length > 0 && (
                            <FilterSection
                                label={t('airlines')} open={open.airlines} onToggle={section('airlines')} palette={palette}
                                resetLabel={reset}
                                onReset={filters.selectedAirlines.length > 0 ? () => onChange({ selectedAirlines: [] }) : undefined}
                            >
                                <CheckList
                                    options={bounds.airlines}
                                    selected={filters.selectedAirlines}
                                    onChange={(next) => onChange({ selectedAirlines: next })}
                                    counts={counts.airlines}
                                    selectAllLabel={t('selectAllAirlines')}
                                    palette={palette}
                                />
                            </FilterSection>
                        )}

                        {/* ── Stops — one of three, or none: picking the lit row again lets go of it. ── */}
                        <FilterSection
                            label={t('stops')} open={open.stops} onToggle={section('stops')} palette={palette}
                            resetLabel={reset}
                            onReset={filters.stops !== null ? () => onChange({ stops: null }) : undefined}
                        >
                            {stopOptions.map((opt) => (
                                <FilterRow
                                    key={opt.value}
                                    label={opt.label}
                                    right={allOffers.length > 0 ? counts.stops[opt.value] : undefined}
                                    active={filters.stops === opt.value}
                                    pressed={filters.stops === opt.value}
                                    palette={palette}
                                    onClick={() => onChange({ stops: filters.stops === opt.value ? null : opt.value })}
                                />
                            ))}
                        </FilterSection>

                        {/* ── Price per person ── */}
                        <FilterSection
                            label={t('pricePerPerson')} open={open.price} onToggle={section('price')} palette={palette}
                            resetLabel={reset}
                            onReset={filters.priceRange || filters.refundableOnly
                                ? () => onChange({ priceRange: null, refundableOnly: false })
                                : undefined}
                        >
                            <FilterSwitch
                                label={t('refundable')}
                                checked={filters.refundableOnly}
                                palette={palette}
                                onChange={(v) => onChange({ refundableOnly: v })}
                            />
                            {filters.refundableOnly && counts.refundable === 0 && allOffers.length > 0 && (
                                <p className="px-1 text-[12px] text-amber-600 dark:text-amber-400">{t('refundableFaresDescription')}</p>
                            )}
                            {hasPriceSpread && (
                                <>
                                    <div className="mt-1 flex items-center gap-2 px-1">
                                        {([0, 1] as const).map((end) => (
                                            <React.Fragment key={end}>
                                                {end === 1 && <span className={palette.muted}>–</span>}
                                                <label className="relative min-w-0 flex-1">
                                                    <span className={cn('pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px]', palette.muted)}>
                                                        {currencySymbol(currency)}
                                                    </span>
                                                    <FilterField
                                                        type="number"
                                                        inputMode="numeric"
                                                        step={1}
                                                        palette={palette}
                                                        aria-label={t(end === 0 ? 'rangeFrom' : 'rangeTo', { label: t('pricePerPerson') })}
                                                        value={priceRange[end]}
                                                        format={(v) => String(Math.round(v))}
                                                        parse={parseNumber}
                                                        normalize={(v) => end === 0
                                                            ? clamp(Math.round(v), bounds.price[0], priceRange[1])
                                                            : clamp(Math.round(v), priceRange[0], bounds.price[1])}
                                                        onCommit={(v) => onChange({ priceRange: end === 0 ? [v, priceRange[1]] : [priceRange[0], v] })}
                                                        className="w-full pl-7"
                                                    />
                                                </label>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div className="mt-3">
                                        <RangeSlider
                                            min={bounds.price[0]}
                                            max={bounds.price[1]}
                                            low={priceRange[0]}
                                            high={priceRange[1]}
                                            palette={palette}
                                            lowLabel={t('rangeFrom', { label: t('pricePerPerson') })}
                                            highLabel={t('rangeTo', { label: t('pricePerPerson') })}
                                            onChange={(lo, hi) => onChange({ priceRange: [lo, hi] })}
                                        />
                                    </div>
                                </>
                            )}
                        </FilterSection>

                        {/* ── Times — typed, not dragged ── */}
                        <FilterSection
                            label={t('times')} open={open.times} onToggle={section('times')} palette={palette}
                            resetLabel={reset}
                            onReset={filters.departureWindow || filters.arrivalWindow
                                ? () => onChange({ departureWindow: null, arrivalWindow: null })
                                : undefined}
                        >
                            {timeWindow(t('departure'), departureWindow, (next) => onChange({ departureWindow: next }))}
                            <div className="mt-2">
                                {timeWindow(t('arrival'), arrivalWindow, (next) => onChange({ arrivalWindow: next }))}
                            </div>
                        </FilterSection>

                        {/* ── Flight duration — a ceiling only, in whole hours ── */}
                        {hasDurationSpread && (
                            <FilterSection
                                label={t('flightDuration')} open={open.duration} onToggle={section('duration')} palette={palette}
                                resetLabel={reset}
                                onReset={filters.maxDurationMinutes !== null ? () => onChange({ maxDurationMinutes: null }) : undefined}
                            >
                                <p className={cn('flex items-center gap-2 px-1 text-[15px]', palette.body)}>
                                    {t.rich('underHoursInput', {
                                        field: () => (
                                            <FilterField
                                                type="number"
                                                inputMode="numeric"
                                                step={1}
                                                palette={palette}
                                                aria-label={t('flightDuration')}
                                                value={Math.ceil(maxDuration / 60)}
                                                format={String}
                                                parse={parseNumber}
                                                normalize={(h) => clamp(Math.round(h), Math.ceil(bounds.duration[0] / 60), Math.ceil(bounds.duration[1] / 60))}
                                                onCommit={(h) => onChange({ maxDurationMinutes: clamp(h * 60, bounds.duration[0], bounds.duration[1]) })}
                                                className="w-16 text-center"
                                            />
                                        ),
                                    })}
                                </p>
                            </FilterSection>
                        )}

                        {/* ── Arrival airports — only when there is a choice to make ── */}
                        {bounds.arrivalAirports.length > 1 && (
                            <FilterSection
                                label={t('arrivalAirports')} open={open.airports} onToggle={section('airports')} palette={palette}
                                resetLabel={reset}
                                onReset={filters.selectedArrivalAirports.length > 0 ? () => onChange({ selectedArrivalAirports: [] }) : undefined}
                            >
                                <CheckList
                                    options={bounds.arrivalAirports}
                                    selected={filters.selectedArrivalAirports}
                                    onChange={(next) => onChange({ selectedArrivalAirports: next })}
                                    counts={counts.airports}
                                    selectAllLabel={t('selectAllAirports')}
                                    palette={palette}
                                />
                            </FilterSection>
                        )}

                        {/* Which supplier a fare came from is ours to know, not the
                            traveller's — shown outside production only. */}
                        {process.env.NODE_ENV !== 'production' && providers.length > 0 && (
                            <FilterSection label={t('provider')} open={open.provider} onToggle={section('provider')} palette={palette}>
                                {providers.map((name) => {
                                    const active = filters.selectedProviders.includes(name);
                                    return (
                                        <FilterRow
                                            key={name}
                                            label={name === 'mystifly_v2' ? 'Mystifly' : name}
                                            right={name === 'mystifly_v2' ? 'Branded fares' : 'NDC fares'}
                                            active={active}
                                            pressed={active}
                                            palette={palette}
                                            onClick={() => onChange({
                                                selectedProviders: active
                                                    ? filters.selectedProviders.filter((p) => p !== name)
                                                    : [...filters.selectedProviders, name],
                                            })}
                                        />
                                    );
                                })}
                            </FilterSection>
                        )}
                    </div>
                </div>
            </aside>

            {/* Collapse handle — straddles the panel's right edge */}
            {onCollapse && (
                <button
                    type="button"
                    onClick={onCollapse}
                    aria-label={tAll('hotels.filters.hide')}
                    className={cn(
                        'absolute top-1/2 -right-5 z-10 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm transition-opacity hover:opacity-85',
                        palette.handle,
                    )}
                >
                    <ChevronLeft size={20} strokeWidth={1.75} />
                </button>
            )}
        </div>
    );
}
