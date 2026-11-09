'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { Flag, Luggage, Hotel, Plane, CloudOff, Search, SearchX, X } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { StateScreen, stateActionClass, stateSecondaryClass } from '@/shared/components/StateScreen';
import { BookingCard } from './booking-card';
import { BookingCardSkeleton, CHIP } from './booking-card-parts';
import { fetchBookings } from '../lib/bookings-api';
import { bookingSearchText, golfSearchText, matchesTerms, queryTerms } from '../lib/booking-search';
import { fetchMyGolfBookings } from '@/features/golf/api/golf.api';
import { GolfBookingCard } from '@/features/golf/components/golf-booking-card';
import type { GolfBooking } from '@/features/golf/types';
import type { AnyBooking } from '@/shared/types';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabValue = 'all' | 'hotels' | 'flights' | 'golf';

/** Icons from `md` up. On a phone the four tabs fit one row only without them. */
const TAB_ICON = 'hidden size-[14px] shrink-0 md:block';

const TABS: { id: TabValue; label: string; icon: React.ReactNode }[] = [
    { id: 'all',     label: 'All',     icon: <Luggage className={TAB_ICON} aria-hidden /> },
    { id: 'hotels',  label: 'Hotels',  icon: <Hotel className={TAB_ICON} aria-hidden /> },
    { id: 'flights', label: 'Flights', icon: <Plane className={TAB_ICON} aria-hidden /> },
    { id: 'golf',    label: 'Golf',    icon: <Flag className={TAB_ICON} aria-hidden /> },
];

/** One row of the list, whichever kind of booking it is, with what orders it among the others. */
type Row = { key: string; at: string } & ({ booking: AnyBooking } | { golf: GolfBooking });

/**
 * The results sidebar's rows, laid out as a row of pills: the selected one in the brand
 * gradient, as a chosen sort is (`filter-panel.tsx`); the rest on the cards' white plate,
 * since they sit on the page ground rather than inside a panel.
 */
const TAB_IDLE = 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-white/90 dark:hover:bg-white/8';

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * The search field, on the tabs' white plate and as round as they are. 16px type on a phone:
 * any smaller and iOS zooms the page in when the field takes focus.
 */
function BookingSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const tAll = useTranslations();
    const inputRef = useRef<HTMLInputElement>(null);
    const clear = () => {
        onChange('');
        inputRef.current?.focus();
    };
    return (
        <div role="search" className="relative w-full md:w-[320px] md:shrink-0">
            <label htmlFor="trips-search" className="sr-only">{tAll('trips.search.label')}</label>
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400 dark:text-white/45"
            />
            <input
                ref={inputRef}
                id="trips-search"
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); }
                }}
                placeholder={tAll('trips.search.placeholder')}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                className={cn(
                    'h-10 w-full rounded-full pl-9 text-base outline-none md:h-9 md:text-[14px]',
                    // Room for the clear button only while there is one, so the placeholder fits.
                    value ? 'pr-10' : 'pr-4',
                    'bg-white text-slate-900 shadow-sm placeholder:text-slate-400',
                    'dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-white/40',
                    'focus-visible:ring-2 focus-visible:ring-blue-500',
                    // The clear button below stands in for the browser's own.
                    '[&::-webkit-search-cancel-button]:appearance-none',
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={clear}
                    aria-label={tAll('trips.search.clear')}
                    className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/8"
                >
                    <X className="size-3.5" aria-hidden />
                </button>
            )}
        </div>
    );
}

function NoMatch({ query, onClear }: { query: string; onClear: () => void }) {
    const tAll = useTranslations();
    return (
        <StateScreen
            icon={SearchX}
            title={tAll('trips.search.noMatch', { query })}
            lines={[tAll('trips.search.noMatchHint')]}
            className="rounded-2xl"
            actions={
                <button type="button" onClick={onClear} className={stateSecondaryClass}>
                    {tAll('trips.search.clear')}
                </button>
            }
        />
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabValue }) {
    const tAll = useTranslations();
    const msg = tab === 'hotels' ? 'No hotel bookings yet'
        : tab === 'flights' ? 'No flight bookings yet'
            : tab === 'golf' ? tAll('trips.golfCard.empty')
                : 'No trips yet';
    return (
        <StateScreen
            icon={Luggage}
            title={msg}
            lines={[tAll('trips.emptyHint')]}
            className="rounded-2xl"
            actions={
                <Link href="/" className={stateActionClass}>
                    {tAll('trips.exploreDestinations')}
                </Link>
            }
        />
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TripsList() {
    const router = useRouter();
    const [bookings, setBookings] = useState<AnyBooking[]>([]);
    const [golf, setGolf] = useState<GolfBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    const [query, setQuery] = useState('');
    /** A load that failed is not an empty list, and must not be drawn as one. */
    const [loadFailed, setLoadFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const tAll = useTranslations();

    useEffect(() => {
        setIsLoading(true);
        setLoadFailed(false);
        // On its own, so a golf outage costs the golf rows and never the hotels and flights.
        fetchMyGolfBookings().then(setGolf).catch(() => setGolf([]));
        fetchBookings(http)
            .then(setBookings)
            .catch((err: Error & { status?: number }) => {
                if (err.status === 401) {
                    router.push('/login?next=/trips');
                } else {
                    setLoadFailed(true);
                }
            })
            .finally(() => setIsLoading(false));
    }, [router, attempt]);

    // The search narrows every tab at once, so each tab's count says where the matches are.
    const terms = queryTerms(query);
    const searching = terms.length > 0;
    const foundBookings = searching ? bookings.filter(b => matchesTerms(bookingSearchText(b), terms)) : bookings;
    const foundGolf = searching ? golf.filter(g => matchesTerms(golfSearchText(g), terms)) : golf;

    const rows: Row[] = [
        ...(activeTab === 'golf' ? [] : foundBookings
            .filter(b => {
                if (activeTab === 'hotels') return b.type === 'hotel';
                if (activeTab === 'flights') return b.type === 'flight';
                return true;
            })
            .map((booking): Row => ({ key: booking.id, at: booking.created_at, booking }))),
        ...(activeTab === 'all' || activeTab === 'golf'
            ? foundGolf.map((g): Row => ({ key: g.reference, at: g.createdAt, golf: g }))
            : []),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Each tab says how many trips are behind it, as a sidebar row says how many results —
    // but only once there is a count to give.
    const counts: Record<TabValue, number> = {
        all:     foundBookings.length + foundGolf.length,
        hotels:  foundBookings.filter(b => b.type === 'hotel').length,
        flights: foundBookings.filter(b => b.type === 'flight').length,
        golf:    foundGolf.length,
    };
    const showCounts = !isLoading && !loadFailed;
    // Nothing to search in an account with no bookings.
    const showSearch = isLoading || loadFailed || bookings.length + golf.length > 0;

    return (
        <div>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Tabs */}
                <div role="group" aria-label={tAll('trips.myTrips')} className="flex flex-wrap gap-1.5 md:gap-2">
                    {TABS.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                aria-pressed={active}
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors',
                                    'md:h-9 md:px-4 md:text-[14px]',
                                    active ? CHIP : TAB_IDLE,
                                )}
                            >
                                {tab.icon}
                                {tab.id === 'golf' ? tAll('landing.search.searchMode.golf') : tab.label}
                                {showCounts && (
                                    <span className={cn('text-[11px] md:text-[12px]', active ? 'opacity-90' : 'opacity-60')}>{counts[tab.id]}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {showSearch && <BookingSearch value={query} onChange={setQuery} />}
            </div>

            {/* What the search found, for a screen reader; a search that found nothing says so below. */}
            <p role="status" className="sr-only">
                {searching && showCounts && rows.length > 0 ? tAll('trips.search.results', { count: rows.length }) : ''}
            </p>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-4">
                    <BookingCardSkeleton />
                    <BookingCardSkeleton />
                    <BookingCardSkeleton />
                </div>
            ) : loadFailed ? (
                <StateScreen
                    icon={CloudOff}
                    title={tAll('trips.loadFailed.title')}
                    className="rounded-2xl"
                    actions={
                        <button type="button" onClick={() => setAttempt(a => a + 1)} className={stateActionClass}>
                            {tAll('trips.loadFailed.retry')}
                        </button>
                    }
                />
            ) : rows.length === 0 && searching ? (
                <NoMatch
                    query={query.trim()}
                    // The button goes with the message, so the focus goes back to the field.
                    onClear={() => { setQuery(''); document.getElementById('trips-search')?.focus(); }}
                />
            ) : rows.length === 0 ? (
                <EmptyState tab={activeTab} />
            ) : (
                <div className="space-y-4">
                    {rows.map((row, i) => (
                        'golf' in row
                            ? <GolfBookingCard key={row.key} booking={row.golf} index={i} />
                            : <BookingCard key={row.key} booking={row.booking} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}
