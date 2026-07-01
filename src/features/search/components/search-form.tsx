'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plane, Hotel, Sparkles, Calendar, Users, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/components/ui/button';
import { useSearchStore, useDates, useTravelers, useActiveDropdown } from '@/shared/stores/search.store';
import { DestinationInput } from './destination-input';
import { DatePicker } from './date-picker';
import { TravelerPicker } from './traveler-picker';

type SearchMode = 'hotels' | 'flights' | 'ai';

const tabs: { id: SearchMode; label: string; icon: React.ReactNode }[] = [
    { id: 'hotels',  label: 'Hotels',  icon: <Hotel  size={15} /> },
    { id: 'flights', label: 'Flights', icon: <Plane  size={15} /> },
    { id: 'ai',      label: 'AI Plan', icon: <Sparkles size={15} /> },
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

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSearchMode(tab.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            searchMode === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/60 dark:border-white/10 p-4">
                {searchMode === 'hotels' && (
                    <div className="flex flex-col sm:flex-row gap-0 rounded-xl border border-slate-200 dark:border-white/10 overflow-visible">
                        {/* Destination */}
                        <div className="relative flex-1 min-w-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => setActiveDropdown(activeDropdown === 'destination' ? null : 'destination')}
                                className="w-full h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                            >
                                <MapPin size={16} className="text-slate-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Destination</div>
                                    <div className={cn('text-sm truncate', destination ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                        {destination?.title || 'Where are you going?'}
                                    </div>
                                </div>
                            </button>
                            <DestinationInput />
                        </div>

                        {/* Check-in */}
                        <div className="relative shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                data-datepicker-trigger
                                onClick={() => setActiveDropdown(activeDropdown === 'dates-in' ? null : 'dates-in')}
                                className="w-full sm:w-44 h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                            >
                                <Calendar size={16} className="text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Check-in</div>
                                    <div className={cn('text-sm truncate', checkIn ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                        {formatDate(checkIn)}
                                    </div>
                                </div>
                            </button>
                            <DatePicker triggerDropdown="dates-in" />
                        </div>

                        {/* Check-out */}
                        <div className="relative shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                data-datepicker-trigger
                                onClick={() => setActiveDropdown(activeDropdown === 'dates-out' ? null : 'dates-out')}
                                className="w-full sm:w-44 h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                            >
                                <Calendar size={16} className="text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Check-out</div>
                                    <div className={cn('text-sm truncate', checkOut ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                        {formatDate(checkOut)}
                                    </div>
                                </div>
                            </button>
                            <DatePicker triggerDropdown="dates-out" initialCheckOutMode />
                        </div>

                        {/* Travelers */}
                        <div className="relative shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => setActiveDropdown(activeDropdown === 'travelers' ? null : 'travelers')}
                                className="w-full sm:w-48 h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                            >
                                <Users size={16} className="text-slate-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Travelers</div>
                                    <div className="text-sm text-slate-800 dark:text-white truncate">
                                        {formatTravelers(adults, children)}
                                    </div>
                                </div>
                                <ChevronDown
                                    size={14}
                                    className={cn('text-slate-400 transition-transform duration-200 shrink-0', activeDropdown === 'travelers' && 'rotate-180')}
                                />
                            </button>
                            <TravelerPicker />
                        </div>

                        {/* Search button */}
                        <div className="shrink-0 p-1.5">
                            <Button
                                onClick={handleSearch}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 rounded-lg gap-2"
                            >
                                <Search size={16} />
                                Search
                            </Button>
                        </div>
                    </div>
                )}

                {searchMode === 'flights' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-0 rounded-xl border border-slate-200 dark:border-white/10 overflow-visible">
                            {/* Origin */}
                            <div className="relative flex-1 min-w-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'flight-origin' ? null : 'flight-origin')}
                                    className="w-full h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <Plane size={16} className="text-slate-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">From</div>
                                        <div className={cn('text-sm truncate', flightState.flights[0]?.origin ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                            {flightState.flights[0]?.origin?.title || 'City or airport'}
                                        </div>
                                    </div>
                                </button>
                                <DestinationInput segmentIndex={0} field="origin" />
                            </div>
                            {/* Destination */}
                            <div className="relative flex-1 min-w-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'flight-destination' ? null : 'flight-destination')}
                                    className="w-full h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <MapPin size={16} className="text-slate-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">To</div>
                                        <div className={cn('text-sm truncate', flightState.flights[0]?.destination ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                            {flightState.flights[0]?.destination?.title || 'City or airport'}
                                        </div>
                                    </div>
                                </button>
                                <DestinationInput segmentIndex={0} field="destination" />
                            </div>

                            {/* Departure date */}
                            <div className="relative shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                                <button
                                    type="button"
                                    data-datepicker-trigger
                                    onClick={() => setActiveDropdown(activeDropdown === 'flight-depart' ? null : 'flight-depart')}
                                    className="w-full sm:w-40 h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <Calendar size={16} className="text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Depart</div>
                                        <div className={cn('text-sm truncate', flightState.flights[0]?.date ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                            {formatDate(flightState.flights[0]?.date ?? null)}
                                        </div>
                                    </div>
                                </button>
                                <DatePicker triggerDropdown="flight-depart" mode="single" segmentIndex={0} />
                            </div>

                            {/* Return date (round-trip only) */}
                            {flightState.tripType === 'round-trip' && (
                                <div className="relative shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10">
                                    <button
                                        type="button"
                                        data-datepicker-trigger
                                        onClick={() => setActiveDropdown(activeDropdown === 'flight-return' ? null : 'flight-return')}
                                        className="w-full sm:w-40 h-11 flex items-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                    >
                                        <Calendar size={16} className="text-slate-400 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Return</div>
                                            <div className={cn('text-sm truncate', flightState.flights[1]?.date ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>
                                                {formatDate(flightState.flights[1]?.date ?? null)}
                                            </div>
                                        </div>
                                    </button>
                                    <DatePicker triggerDropdown="flight-return" mode="single" segmentIndex={1} />
                                </div>
                            )}

                            {/* Search button */}
                            <div className="shrink-0 p-1.5">
                                <Button
                                    onClick={handleSearch}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 rounded-lg gap-2"
                                >
                                    <Search size={16} />
                                    Search
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {searchMode === 'ai' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
                            Let AI plan your perfect trip — tell it where you want to go, when, and with whom.
                        </p>
                        <Button
                            onClick={handleSearch}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 rounded-xl gap-2"
                        >
                            <Sparkles size={16} />
                            Start AI Trip Planning
                        </Button>
                    </div>
                )}

                {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                )}
            </div>
        </div>
    );
}
