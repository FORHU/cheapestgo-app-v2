'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    useSearchStore, useDates, useTravelers, useActiveDropdown, useFlightState, useDestination,
} from '@/shared/stores/search.store';
import { DestinationInput } from '@/features/search/components/destination-input';
import { DatePicker } from '@/features/search/components/date-picker';
import { TravelerPicker } from '@/features/search/components/traveler-picker';
import {
    BUDGET_FILTERS, BUDGET_MAX, BUDGET_MIN, BUDGET_STEP, NIGHTS,
} from '@/features/landing/data/catalog';
import { useBudgetStore, matchTrips } from '@/features/landing/stores/budget.store';
import { useMoney } from '@/features/landing/lib/money';
import { flightSearchUrl, hotelSearchUrl } from '@/features/landing/lib/links';
import { TicketStub, TICKET_SURFACE } from '@/shared/components/ui/ticket-stub';

type Tab = 'flights' | 'hotels' | 'budget';

const TABS: { id: Tab; label: string }[] = [
    { id: 'flights', label: 'Flights' },
    { id: 'hotels', label: 'Hotels' },
    { id: 'budget', label: 'Where can I go?' },
];

/** Anchor the "Show N destinations" button scrolls to. */
export const BUNDLES_ANCHOR = 'trip-bundles';

// ─── Ticket chrome ────────────────────────────────────────────────────────────

const PANEL =
    'relative w-full max-w-[900px] mx-auto rounded-[22px] text-left ' +
    '[--ticket-bg:#ffffff] dark:[--ticket-bg:#0f1223] ' +
    'shadow-[0_24px_48px_-18px_rgba(2,6,23,0.26)] dark:shadow-[0_24px_48px_-18px_rgba(0,0,0,0.65)]';

/** Hairline between fields: stacked on mobile, columnar from `md` up. */
const DIVIDER = 'border-t md:border-t-0 md:border-l border-slate-200/70 dark:border-white/10';

const FIELD =
    'w-full text-left px-3.5 py-3 rounded-[10px] transition-colors ' +
    'hover:bg-slate-100/80 dark:hover:bg-white/5';

const LABEL = 'text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-1';

const SUBMIT =
    'w-full h-12 rounded-[14px] bg-blue-600 hover:bg-blue-500 active:scale-[0.985] ' +
    'text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors ' +
    'disabled:opacity-50 disabled:pointer-events-none';

function fieldValue(hasValue: boolean) {
    return cn(
        'text-sm font-semibold truncate',
        hasValue ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
    );
}

function shortDate(d: Date | null | undefined, empty = 'Add date'): string {
    if (!d) return empty;
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return empty;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Boarding pass: fields and the search action above the perforation, a tear-off
 * stub below it.
 */
function Ticket({
    children, action, note,
}: {
    children: React.ReactNode;
    action: React.ReactNode;
    note: string;
}) {
    return (
        <div className={PANEL} style={TICKET_SURFACE}>
            <div className="p-2.5">
                {children}
                <div className="px-1 pt-2.5 pb-1">{action}</div>
            </div>

            <TicketStub note={note} />
        </div>
    );
}

// ─── Flight type ──────────────────────────────────────────────────────────────

/** The ticket carries a single outbound and return leg, so multi-city is out. */
const TRIP_TYPES = [
    { id: 'round-trip', label: 'Round trip' },
    { id: 'one-way', label: 'One way' },
] as const;

function TripTypePicker() {
    const ref = useRef<HTMLDivElement>(null);
    const activeDropdown = useActiveDropdown();
    const tripType = useFlightState().tripType;
    const { setFlightType, setActiveDropdown } = useSearchStore();
    const isOpen = activeDropdown === 'flight-type';

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setActiveDropdown(null);
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, setActiveDropdown]);

    if (!isOpen) return null;

    return (
        <div
            ref={ref}
            className="absolute top-full left-0 mt-3 w-[200px] p-1.5 z-[100] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-white/10"
        >
            {TRIP_TYPES.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                        setFlightType(t.id);
                        setActiveDropdown(null);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                    {t.label}
                    {tripType === t.id && <Check size={15} strokeWidth={2.5} className="text-blue-600" />}
                </button>
            ))}
        </div>
    );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function LandingHero() {
    const router = useRouter();
    const hydrated = useHydrated();
    const money = useMoney();

    const [tab, setTab] = useState<Tab>('flights');
    const [error, setError] = useState<string | null>(null);

    const {
        setSearchMode, setActiveDropdown, setIsSearching, addRecentSearch,
    } = useSearchStore();
    const activeDropdown = useActiveDropdown();
    const destination = useDestination();
    const dates = useDates();
    const travelers = useTravelers();
    const flightState = useFlightState();

    const budget = useBudgetStore((s) => s.budget);
    const chips = useBudgetStore((s) => s.chips);
    const setBudget = useBudgetStore((s) => s.setBudget);
    const toggleChip = useBudgetStore((s) => s.toggleChip);

    // Persisted store values must not reach the first render — see useHydrated.
    const flightLeg = hydrated ? flightState.flights[0] : undefined;
    const returnLeg = hydrated ? flightState.flights[1] : undefined;
    const hotelDestination = hydrated ? destination : null;
    const checkIn = hydrated ? dates.checkIn : null;
    const checkOut = hydrated ? dates.checkOut : null;
    const adults = hydrated ? travelers.adults : 2;
    const children = hydrated ? travelers.children : 0;
    const rooms = hydrated ? travelers.rooms : 1;
    const roundTrip = hydrated ? flightState.tripType !== 'one-way' : true;

    const matches = useMemo(() => matchTrips(budget, chips), [budget, chips]);

    const selectTab = (next: Tab) => {
        setTab(next);
        setError(null);
        setActiveDropdown(null);
        if (next === 'flights' || next === 'hotels') setSearchMode(next);
    };

    const toggle = (key: string) => setActiveDropdown(activeDropdown === key ? null : key);

    // ── Search handlers ───────────────────────────────────────────────────────

    const searchFlights = () => {
        const leg = flightState.flights[0];
        if (!leg?.origin || !leg?.destination) return setError('Pick where you are flying from and to.');
        if (!leg.date) return setError('Pick a departure date.');

        // A round trip with no return date still searches as one way.
        const returnDate =
            flightState.tripType === 'one-way' ? undefined : flightState.flights[1]?.date;

        setError(null);
        setIsSearching(true);
        router.push(
            flightSearchUrl({
                origin: leg.origin.code ?? leg.origin.title,
                destination: leg.destination.code ?? leg.destination.title,
                depart: new Date(leg.date).toISOString().slice(0, 10),
                ret: returnDate ? new Date(returnDate).toISOString().slice(0, 10) : undefined,
                tripType: returnDate ? 'round-trip' : 'one-way',
                cabin: flightState.cabinClass,
                adults: Math.max(1, travelers.adults),
                children: travelers.children,
                infants: flightState.passengers.infants,
            })
        );
    };

    const searchHotels = () => {
        if (!destination) return setError('Pick a destination.');
        if (!dates.checkIn || !dates.checkOut) return setError('Pick check-in and check-out dates.');

        setError(null);
        setIsSearching(true);
        addRecentSearch(destination);
        router.push(
            hotelSearchUrl({
                destination: destination.title,
                checkIn: new Date(dates.checkIn).toISOString().slice(0, 10),
                checkOut: new Date(dates.checkOut).toISOString().slice(0, 10),
                adults: Math.max(1, travelers.adults),
                children: travelers.children,
                rooms: travelers.rooms,
                lat: destination.lat,
                lng: destination.lng,
                countryCode: destination.countryCode,
                code: destination.code,
                type: destination.type,
            })
        );
    };

    const showMatches = () => {
        document.getElementById(BUNDLES_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <section className="max-w-[1240px] mx-auto px-6 pt-[clamp(40px,6vw,72px)] pb-[clamp(40px,5vw,64px)] flex flex-col items-center text-center">
            <h1 className="font-display font-bold tracking-[-0.035em] leading-[1.03] text-[clamp(38px,5vw,56px)] text-slate-900 dark:text-white">
                Fly anywhere
                <br />
                for less.
            </h1>
            <p className="mt-[22px] text-[17px] leading-relaxed text-slate-600 dark:text-slate-400 max-w-[500px]">
                Every major flight and hotel supplier, compared at once. Taxes and fees included, no booking fee.
            </p>

            {/* Tabs */}
            <div role="tablist" aria-label="Search type" className="flex justify-center gap-7 mt-[26px]">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => selectTab(t.id)}
                        className={cn(
                            'text-sm font-semibold pb-[7px] transition-colors border-b-2',
                            tab === t.id
                                ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white'
                                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="w-full max-w-[900px] mt-[22px]">
                {/* ── Flights ──────────────────────────────────────────────── */}
                {tab === 'flights' && (
                    <Ticket
                        note="Taxes and fees included"
                        action={
                            <button type="button" onClick={searchFlights} className={SUBMIT}>
                                <Search size={17} strokeWidth={2.5} />
                                Search flights
                            </button>
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.1fr_0.95fr_0.95fr_0.95fr_1fr]">
                            <div className="relative">
                                <button type="button" onClick={() => toggle('flight-origin')} className={FIELD}>
                                    <div className={LABEL}>From</div>
                                    <div className={fieldValue(!!flightLeg?.origin)}>
                                        {flightLeg?.origin?.title ?? 'City or airport'}
                                    </div>
                                </button>
                                <DestinationInput segmentIndex={0} field="origin" />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button type="button" onClick={() => toggle('flight-destination')} className={FIELD}>
                                    <div className={LABEL}>To</div>
                                    <div className={fieldValue(!!flightLeg?.destination)}>
                                        {flightLeg?.destination?.title ?? 'City or airport'}
                                    </div>
                                </button>
                                <DestinationInput segmentIndex={0} field="destination" />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button
                                    type="button"
                                    data-datepicker-trigger
                                    onClick={() => toggle('flight-depart')}
                                    className={FIELD}
                                >
                                    <div className={LABEL}>Depart</div>
                                    <div className={cn('font-mono', fieldValue(!!flightLeg?.date))}>
                                        {shortDate(flightLeg?.date)}
                                    </div>
                                </button>
                                <DatePicker triggerDropdown="flight-depart" mode="single" segmentIndex={0} />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button
                                    type="button"
                                    data-datepicker-trigger
                                    disabled={!roundTrip}
                                    onClick={() => toggle('flight-return')}
                                    className={cn(FIELD, 'disabled:hover:bg-transparent')}
                                >
                                    <div className={LABEL}>Return</div>
                                    <div className={cn('font-mono', fieldValue(roundTrip && !!returnLeg?.date))}>
                                        {roundTrip ? shortDate(returnLeg?.date) : '—'}
                                    </div>
                                </button>
                                {roundTrip && (
                                    <DatePicker triggerDropdown="flight-return" mode="single" segmentIndex={1} />
                                )}
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button type="button" onClick={() => toggle('flight-type')} className={FIELD}>
                                    <div className={LABEL}>Flight type</div>
                                    <div className={fieldValue(true)}>{roundTrip ? 'Round trip' : 'One way'}</div>
                                </button>
                                <TripTypePicker />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button type="button" onClick={() => toggle('travelers')} className={FIELD}>
                                    <div className={LABEL}>Travelers</div>
                                    <div className={fieldValue(true)}>
                                        {adults} adult{adults !== 1 ? 's' : ''}
                                        {children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}
                                    </div>
                                </button>
                                <TravelerPicker />
                            </div>
                        </div>
                    </Ticket>
                )}

                {/* ── Hotels ───────────────────────────────────────────────── */}
                {tab === 'hotels' && (
                    <Ticket
                        note="Taxes and fees included"
                        action={
                            <button type="button" onClick={searchHotels} className={SUBMIT}>
                                <Search size={17} strokeWidth={2.5} />
                                Search hotels
                            </button>
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.9fr_0.9fr_1.1fr]">
                            <div className="relative">
                                <button type="button" onClick={() => toggle('destination')} className={FIELD}>
                                    <div className={LABEL}>Where</div>
                                    <div className={fieldValue(!!hotelDestination)}>
                                        {hotelDestination?.title ?? 'City, region or country'}
                                    </div>
                                </button>
                                <DestinationInput />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button
                                    type="button"
                                    data-datepicker-trigger
                                    onClick={() => toggle('dates-in')}
                                    className={FIELD}
                                >
                                    <div className={LABEL}>Check in</div>
                                    <div className={cn('font-mono', fieldValue(!!checkIn))}>{shortDate(checkIn)}</div>
                                </button>
                                <DatePicker triggerDropdown="dates-in" />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button
                                    type="button"
                                    data-datepicker-trigger
                                    onClick={() => toggle('dates-out')}
                                    className={FIELD}
                                >
                                    <div className={LABEL}>Check out</div>
                                    <div className={cn('font-mono', fieldValue(!!checkOut))}>{shortDate(checkOut)}</div>
                                </button>
                                <DatePicker triggerDropdown="dates-out" initialCheckOutMode />
                            </div>

                            <div className={cn('relative', DIVIDER)}>
                                <button type="button" onClick={() => toggle('travelers')} className={FIELD}>
                                    <div className={LABEL}>Guests</div>
                                    <div className={fieldValue(true)}>
                                        {adults + children} guest{adults + children !== 1 ? 's' : ''}, {rooms} room
                                        {rooms !== 1 ? 's' : ''}
                                    </div>
                                </button>
                                <TravelerPicker />
                            </div>
                        </div>
                    </Ticket>
                )}

                {/* ── Where can I go? ──────────────────────────────────────── */}
                {tab === 'budget' && (
                    <Ticket
                        note={`Flight + ${NIGHTS} nights, per person`}
                        action={
                            <button
                                type="button"
                                onClick={showMatches}
                                disabled={matches.length === 0}
                                className={SUBMIT}
                            >
                                {matches.length === 0
                                    ? 'No destinations match'
                                    : `Show ${matches.length} destination${matches.length !== 1 ? 's' : ''}`}
                            </button>
                        }
                    >
                        <div className="px-4 pt-3 pb-4 grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-x-8 gap-y-4 items-center">
                            <div>
                                <div className={LABEL}>Maximum budget</div>
                                <span className="font-mono font-bold text-[30px] tracking-[-0.02em] text-slate-900 dark:text-white">
                                    {money(budget)}
                                </span>
                                <input
                                    type="range"
                                    aria-label="Maximum trip budget"
                                    min={BUDGET_MIN}
                                    max={BUDGET_MAX}
                                    step={BUDGET_STEP}
                                    value={budget}
                                    onChange={(e) => setBudget(Number(e.target.value))}
                                    className="w-full accent-blue-600 cursor-pointer mt-2"
                                />
                            </div>

                            <div>
                                <div className={LABEL}>What are you after?</div>
                                <div className="flex flex-wrap gap-2">
                                    {BUDGET_FILTERS.map((f) => {
                                        const on = chips.includes(f.id);
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => toggleChip(f.id)}
                                                className={cn(
                                                    'text-xs font-semibold px-3 py-[7px] rounded-full border transition-colors',
                                                    on
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                                                )}
                                            >
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </Ticket>
                )}

                {error && (
                    <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
                        {error}
                    </p>
                )}
            </div>
        </section>
    );
}
