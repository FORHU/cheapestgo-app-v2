'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plane, Hotel, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/components/ui/button';
import { useSearchStore } from '@/shared/stores/search.store';
import { DestinationInput } from './destination-input';
import { DatePicker } from './date-picker';
import { TravelerPicker } from './traveler-picker';

type SearchMode = 'hotels' | 'flights' | 'ai';

const tabs: { id: SearchMode; label: string; icon: React.ReactNode }[] = [
    { id: 'hotels',  label: 'Hotels',  icon: <Hotel  size={15} /> },
    { id: 'flights', label: 'Flights', icon: <Plane  size={15} /> },
    { id: 'ai',      label: 'AI Plan', icon: <Sparkles size={15} /> },
];

export function SearchForm() {
    const router = useRouter();
    const {
        searchMode, setSearchMode,
        destination, dates, travelers,
        flightState,
        setIsSearching,
    } = useSearchStore();

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
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 min-w-0">
                            <DestinationInput placeholder="Where are you going?" />
                        </div>
                        <div className="shrink-0">
                            <DatePicker />
                        </div>
                        <div className="shrink-0">
                            <TravelerPicker />
                        </div>
                        <Button
                            onClick={handleSearch}
                            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl gap-2"
                        >
                            <Search size={16} />
                            Search
                        </Button>
                    </div>
                )}

                {searchMode === 'flights' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1 min-w-0">
                                <DestinationInput placeholder="From where?" segmentIndex={0} field="origin" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DestinationInput placeholder="To where?" segmentIndex={0} field="destination" />
                            </div>
                            <div className="shrink-0">
                                <DatePicker mode="single" label="Departure" />
                            </div>
                            {flightState.tripType === 'round-trip' && (
                                <div className="shrink-0">
                                    <DatePicker mode="single" label="Return" segmentIndex={1} />
                                </div>
                            )}
                            <Button
                                onClick={handleSearch}
                                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl gap-2"
                            >
                                <Search size={16} />
                                Search
                            </Button>
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
