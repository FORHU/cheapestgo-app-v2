'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plane, BedDouble, Sparkles, Calendar, Users, ChevronDown, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useSearchStore, useDates, useTravelers, useActiveDropdown } from '@/shared/stores/search.store';
import { DestinationInput } from './destination-input';
import { DatePicker } from './date-picker';
import { TravelerPicker } from './traveler-picker';

type SearchMode = 'hotels' | 'flights' | 'ai';

const tabs: { id: SearchMode; label: string; icon: React.ReactNode; mobileIcon: React.ReactNode }[] = [
    { id: 'hotels',  label: 'Stays',     icon: <BedDouble size={14} />, mobileIcon: <BedDouble size={12} /> },
    { id: 'flights', label: 'Flights',   icon: <Plane size={14} />,     mobileIcon: <Plane size={12} /> },
    { id: 'ai',      label: 'AI Search', icon: <Sparkles size={14} />,  mobileIcon: <Sparkles size={12} /> },
];

function formatDate(date: Date | null): string {
    if (!date) return 'Select date';
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTravelers(adults: number, children: number): string {
    const total = adults + children;
    return `${total} ${total === 1 ? 'traveler' : 'travelers'}, 1 room`;
}

export function SearchForm() {
    const router = useRouter();
    const {
        searchMode, setSearchMode,
        destination, dates, travelers,
        flightState,
        setIsSearching,
        setActiveDropdown,
    } = useSearchStore();

    const { checkIn, checkOut } = useDates();
    const { adults, children } = useTravelers();
    const activeDropdown = useActiveDropdown();

    const [error, setError] = useState<string | null>(null);

    const handleSearch = () => {
        setError(null);

        if (searchMode === 'hotels') {
            if (!destination) { setError('Please enter a destination'); return; }
            if (!dates.checkIn || !dates.checkOut) { setError('Please select check-in and check-out dates'); return; }

            const params = new URLSearchParams({
                destination:  destination.title,
                code:         destination.code ?? '',
                type:         destination.type,
                lat:          String(destination.id?.split(',')[0] ?? ''),
                lng:          String(destination.id?.split(',')[1] ?? ''),
                checkIn:      dates.checkIn.toISOString().slice(0, 10),
                checkOut:     dates.checkOut.toISOString().slice(0, 10),
                adults:       String(travelers.adults),
                children:     String(travelers.children),
                rooms:        String(travelers.rooms),
            });
            setIsSearching(true);
            router.push(`/hotels/search?${params}`);
        }

        if (searchMode === 'flights') {
            const { flights, tripType, cabinClass, passengers } = flightState;
            const first = flights[0];
            if (!first.origin || !first.destination) { setError('Please enter origin and destination'); return; }
            if (!first.date) { setError('Please select a departure date'); return; }

            const params = new URLSearchParams({
                origin:      first.origin.code ?? first.origin.title,
                destination: first.destination.code ?? first.destination.title,
                depart:      first.date.toISOString().slice(0, 10),
                tripType,
                cabin:       cabinClass,
                adults:      String(passengers.adults),
                children:    String(passengers.children),
                infants:     String(passengers.infants),
            });
            if (tripType === 'round-trip' && flights[1]?.date) {
                params.set('return', flights[1].date.toISOString().slice(0, 10));
            }
            setIsSearching(true);
            router.push(`/flights/search?${params}`);
        }

        if (searchMode === 'ai') {
            router.push('/ai-chat');
        }
    };

    /* reusable class strings */
    const fieldBtn = 'w-full h-full min-h-[56px] flex items-center gap-2.5 px-4 hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors text-left';
    const fieldLabel = 'text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider';
    const fieldValue = (hasValue: boolean) =>
        cn('text-sm font-medium truncate mt-0.5', hasValue ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500');
    const divider = 'border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-white/5';

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex justify-center mb-4 md:mb-6">
                <div className="inline-flex bg-white dark:bg-white/5 rounded-full p-1 border border-slate-200 dark:border-white/10 shadow-sm">
                    {tabs.map(tab => (
                        <motion.button
                            key={tab.id}
                            onClick={() => setSearchMode(tab.id)}
                            className={cn(
                                'relative flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-colors duration-200',
                                searchMode === tab.id
                                    ? 'text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            )}
                            whileHover={{ scale: searchMode === tab.id ? 1 : 1.04 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            {searchMode === tab.id && (
                                <motion.div
                                    layoutId="searchTabBg"
                                    className="absolute inset-0 bg-blue-600 rounded-full shadow-md"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                                <span className="hidden sm:inline">{tab.icon}</span>
                                <span className="sm:hidden">{tab.mobileIcon}</span>
                                {tab.label}
                            </span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Search Card */}
            <div
                className="bg-white dark:bg-[#0f172a] rounded-2xl p-2"
                style={{ boxShadow: '0 0 0 1px rgba(37,99,235,0.12), 0 8px 32px rgba(37,99,235,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
            >
                {searchMode === 'hotels' && (
                    <div className="flex flex-col sm:flex-row bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5 overflow-visible">
                        {/* Destination */}
                        <div className={cn('relative flex-1 min-w-0', divider)}>
                            <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'destination' ? null : 'destination')} className={fieldBtn}>
                                <MapPin size={16} className="text-blue-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className={fieldLabel}>Destination</div>
                                    <div className={fieldValue(!!destination)}>{destination?.title || 'Where are you going?'}</div>
                                </div>
                            </button>
                            <DestinationInput />
                        </div>

                        {/* Check-in */}
                        <div className={cn('relative shrink-0', divider)}>
                            <button type="button" data-datepicker-trigger onClick={() => setActiveDropdown(activeDropdown === 'dates-in' ? null : 'dates-in')} className={cn(fieldBtn, 'sm:w-40')}>
                                <Calendar size={16} className="text-blue-400 shrink-0" />
                                <div className="min-w-0">
                                    <div className={fieldLabel}>Check-in</div>
                                    <div className={fieldValue(!!checkIn)}>{formatDate(checkIn)}</div>
                                </div>
                            </button>
                            <DatePicker triggerDropdown="dates-in" />
                        </div>

                        {/* Check-out */}
                        <div className={cn('relative shrink-0', divider)}>
                            <button type="button" data-datepicker-trigger onClick={() => setActiveDropdown(activeDropdown === 'dates-out' ? null : 'dates-out')} className={cn(fieldBtn, 'sm:w-40')}>
                                <Calendar size={16} className="text-blue-400 shrink-0" />
                                <div className="min-w-0">
                                    <div className={fieldLabel}>Check-out</div>
                                    <div className={fieldValue(!!checkOut)}>{formatDate(checkOut)}</div>
                                </div>
                            </button>
                            <DatePicker triggerDropdown="dates-out" initialCheckOutMode />
                        </div>

                        {/* Travelers */}
                        <div className={cn('relative shrink-0', divider)}>
                            <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'travelers' ? null : 'travelers')} className={cn(fieldBtn, 'sm:w-44')}>
                                <Users size={16} className="text-blue-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className={fieldLabel}>Travelers</div>
                                    <div className={fieldValue(true)}>{formatTravelers(adults, children)}</div>
                                </div>
                                <ChevronDown size={14} className={cn('text-slate-400 transition-transform shrink-0', activeDropdown === 'travelers' && 'rotate-180')} />
                            </button>
                            <TravelerPicker />
                        </div>

                        {/* Search */}
                        <div className="shrink-0 p-1.5 flex items-center">
                            <button onClick={handleSearch} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm px-6 h-12 rounded-xl shadow-md shadow-blue-500/20 transition-colors">
                                <Search size={16} />
                                Search
                            </button>
                        </div>
                    </div>
                )}

                {searchMode === 'flights' && (
                    <div className="flex flex-col sm:flex-row bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5 overflow-visible">
                        {/* Origin */}
                        <div className={cn('relative flex-1 min-w-0', divider)}>
                            <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'flight-origin' ? null : 'flight-origin')} className={fieldBtn}>
                                <Plane size={16} className="text-blue-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className={fieldLabel}>From</div>
                                    <div className={fieldValue(!!flightState.flights[0]?.origin)}>{flightState.flights[0]?.origin?.title || 'City or airport'}</div>
                                </div>
                            </button>
                            <DestinationInput segmentIndex={0} field="origin" />
                        </div>

                        {/* Destination */}
                        <div className={cn('relative flex-1 min-w-0', divider)}>
                            <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'flight-destination' ? null : 'flight-destination')} className={fieldBtn}>
                                <MapPin size={16} className="text-blue-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className={fieldLabel}>To</div>
                                    <div className={fieldValue(!!flightState.flights[0]?.destination)}>{flightState.flights[0]?.destination?.title || 'City or airport'}</div>
                                </div>
                            </button>
                            <DestinationInput segmentIndex={0} field="destination" />
                        </div>

                        {/* Depart */}
                        <div className={cn('relative shrink-0', divider)}>
                            <button type="button" data-datepicker-trigger onClick={() => setActiveDropdown(activeDropdown === 'flight-depart' ? null : 'flight-depart')} className={cn(fieldBtn, 'sm:w-36')}>
                                <Calendar size={16} className="text-blue-400 shrink-0" />
                                <div className="min-w-0">
                                    <div className={fieldLabel}>Depart</div>
                                    <div className={fieldValue(!!flightState.flights[0]?.date)}>{formatDate(flightState.flights[0]?.date ?? null)}</div>
                                </div>
                            </button>
                            <DatePicker triggerDropdown="flight-depart" mode="single" segmentIndex={0} />
                        </div>

                        {/* Return */}
                        {flightState.tripType === 'round-trip' && (
                            <div className={cn('relative shrink-0', divider)}>
                                <button type="button" data-datepicker-trigger onClick={() => setActiveDropdown(activeDropdown === 'flight-return' ? null : 'flight-return')} className={cn(fieldBtn, 'sm:w-36')}>
                                    <Calendar size={16} className="text-blue-400 shrink-0" />
                                    <div className="min-w-0">
                                        <div className={fieldLabel}>Return</div>
                                        <div className={fieldValue(!!flightState.flights[1]?.date)}>{formatDate(flightState.flights[1]?.date ?? null)}</div>
                                    </div>
                                </button>
                                <DatePicker triggerDropdown="flight-return" mode="single" segmentIndex={1} />
                            </div>
                        )}

                        {/* Search */}
                        <div className="shrink-0 p-1.5 flex items-center">
                            <button onClick={handleSearch} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm px-6 h-12 rounded-xl shadow-md shadow-blue-500/20 transition-colors">
                                <Search size={16} />
                                Search
                            </button>
                        </div>
                    </div>
                )}

                {searchMode === 'ai' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <p className="text-slate-500 dark:text-slate-400 text-sm text-center max-w-xs">
                            Let AI plan your perfect trip — tell it where you want to go, when, and with whom.
                        </p>
                        <button onClick={handleSearch} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 h-12 rounded-xl shadow-md shadow-blue-500/20 transition-colors">
                            <Sparkles size={16} />
                            Start AI Trip Planning
                        </button>
                    </div>
                )}

                {error && <p className="mt-2 px-2 text-sm text-red-500">{error}</p>}
            </div>
        </div>
    );
}
