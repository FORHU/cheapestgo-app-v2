import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    Destination,
    DateRange,
    TravelersConfig,
    SearchFilters,
    FlightState,
    FlightSegment,
    RoomOccupancy,
} from '@/shared/types';

// ─── Re-export types used by consumers ────────────────────────────────────────
export type { Destination, DateRange, TravelersConfig, RoomOccupancy };

// ─── Suggestions state ────────────────────────────────────────────────────────
export interface SuggestionsState {
    items: Destination[];
    loading: boolean;
}

// ─── Full store shape ─────────────────────────────────────────────────────────
interface SearchState {
    // Destination
    destination: Destination | null;
    destinationQuery: string;

    // Dates
    dates: DateRange;

    // Travelers
    travelers: TravelersConfig;

    // Locale prefs (persisted)
    userCurrency: string;
    userCountry: string;

    // Recent searches (persisted)
    recentSearches: Destination[];

    // UI
    activeDropdown: string | null;
    isSearching: boolean;

    // Filters
    filters: SearchFilters;
    isMobileFiltersOpen: boolean;

    // Destination suggestions
    suggestions: SuggestionsState;

    // Search mode & flight state (persisted)
    searchMode: 'hotels' | 'flights' | 'ai';
    flightState: FlightState;

    // ─── Actions ────────────────────────────────────────────────────────────
    setDestination: (d: Destination | null) => void;
    setDestinationQuery: (q: string) => void;
    setDates: (dates: Partial<DateRange>) => void;
    setTravelers: (t: Partial<TravelersConfig>) => void;
    setUserCurrency: (c: string) => void;
    setUserCountry: (c: string) => void;
    addRecentSearch: (d: Destination) => void;
    removeRecentSearch: (title: string) => void;
    clearRecentSearches: () => void;
    updateRecentSearchPrice: (title: string, price: number, currency: string) => void;
    setActiveDropdown: (k: string | null) => void;
    setIsSearching: (v: boolean) => void;

    // Filter actions
    setIsMobileFiltersOpen: (v: boolean) => void;
    setFilters: (f: Partial<SearchFilters>) => void;
    toggleStarRating: (star: number) => void;
    toggleFacility: (id: number) => void;
    togglePropertyType: (type: string) => void;
    toggleBoardType: (code: string) => void;
    setRefundable: (v: boolean | null) => void;
    resetFilters: () => void;

    // Suggestions
    setSuggestions: (items: Destination[]) => void;
    setSuggestionsLoading: (loading: boolean) => void;

    // Flight actions
    setSearchMode: (mode: 'hotels' | 'flights' | 'ai') => void;
    setFlightType: (type: FlightState['tripType']) => void;
    setFlightCabin: (cabin: FlightState['cabinClass']) => void;
    setFlightSegment: (index: number, segment: Partial<FlightSegment>) => void;
    addFlightSegment: () => void;
    removeFlightSegment: (index: number) => void;
    setFlightPassengers: (p: Partial<FlightState['passengers']>) => void;

    reset: () => void;
}

// ─── Initial values ───────────────────────────────────────────────────────────
const initialDates: DateRange = { checkIn: null, checkOut: null, flexibility: 'exact' };
const initialTravelers: TravelersConfig = { adults: 2, children: 0, rooms: 1 };
const initialFilters: SearchFilters = {
    hotelName: '',
    starRating: [],
    minRating: 0,
    minReviewsCount: 0,
    facilities: [],
    strictFacilityFiltering: false,
    propertyTypes: [],
    boardTypes: [],
    refundable: null,
};
const initialFlightState: FlightState = {
    tripType: 'round-trip',
    cabinClass: 'economy',
    flights: [
        { id: '1', origin: null, destination: null, date: null },
        { id: '2', origin: null, destination: null, date: null },
    ],
    passengers: { adults: 1, children: 0, infants: 0 },
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useSearchStore = create<SearchState>()(
    persist(
        (set) => ({
            destination: null,
            destinationQuery: '',
            dates: initialDates,
            travelers: initialTravelers,
            userCurrency: 'KRW',
            userCountry: 'KR',
            recentSearches: [],
            activeDropdown: null,
            isSearching: false,
            filters: initialFilters,
            isMobileFiltersOpen: false,
            suggestions: { items: [], loading: false },
            searchMode: 'hotels',
            flightState: initialFlightState,

            setDestination: (destination) => set({ destination }),
            setDestinationQuery: (destinationQuery) => set({ destinationQuery }),

            setDates: (dates) => set((s) => {
                const next = { ...s.dates, ...dates };
                if (next.checkIn) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (next.checkIn <= today) {
                        const tomorrow = new Date(today);
                        tomorrow.setDate(today.getDate() + 1);
                        next.checkIn = tomorrow;
                        if (next.checkOut && next.checkOut <= next.checkIn) {
                            const d2 = new Date(tomorrow);
                            d2.setDate(tomorrow.getDate() + 1);
                            next.checkOut = d2;
                        }
                    }
                }
                return { dates: next };
            }),

            setTravelers: (t) => set((s) => ({ travelers: { ...s.travelers, ...t } })),
            setUserCurrency: (userCurrency) => set({ userCurrency }),
            setUserCountry: (userCountry) => set({ userCountry }),

            addRecentSearch: (destination) => set((s) => {
                const filtered = s.recentSearches.filter((d) => d.title !== destination.title);
                return { recentSearches: [destination, ...filtered].slice(0, 5) };
            }),
            removeRecentSearch: (title) => set((s) => ({
                recentSearches: s.recentSearches.filter((d) => d.title !== title),
            })),
            clearRecentSearches: () => set({ recentSearches: [] }),
            updateRecentSearchPrice: (title, price, currency) => set((s) => ({
                recentSearches: s.recentSearches.map((d) =>
                    d.title === title ? { ...d, lowestPrice: price, priceCurrency: currency } : d
                ),
            })),

            setActiveDropdown: (activeDropdown) => set({ activeDropdown }),
            setIsSearching: (isSearching) => set({ isSearching }),

            setIsMobileFiltersOpen: (isMobileFiltersOpen) => set({ isMobileFiltersOpen }),
            setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
            toggleStarRating: (star) => set((s) => {
                const cur = s.filters.starRating;
                const next = cur.includes(star) ? cur.filter((x) => x !== star) : [...cur, star].sort((a, b) => b - a);
                return { filters: { ...s.filters, starRating: next } };
            }),
            toggleFacility: (id) => set((s) => {
                const cur = s.filters.facilities;
                const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                return { filters: { ...s.filters, facilities: next } };
            }),
            togglePropertyType: (type) => set((s) => {
                const cur = s.filters.propertyTypes;
                const next = cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type];
                return { filters: { ...s.filters, propertyTypes: next } };
            }),
            toggleBoardType: (code) => set((s) => {
                const cur = s.filters.boardTypes;
                const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
                return { filters: { ...s.filters, boardTypes: next } };
            }),
            setRefundable: (refundable) => set((s) => ({ filters: { ...s.filters, refundable } })),
            resetFilters: () => set({ filters: initialFilters }),

            setSuggestions: (items) => set((s) => ({ suggestions: { ...s.suggestions, items } })),
            setSuggestionsLoading: (loading) => set((s) => ({ suggestions: { ...s.suggestions, loading } })),

            setSearchMode: (searchMode) => set({ searchMode }),
            setFlightType: (type) => set((s) => ({ flightState: { ...s.flightState, tripType: type } })),
            setFlightCabin: (cabin) => set((s) => ({ flightState: { ...s.flightState, cabinClass: cabin } })),

            setFlightSegment: (index, segment) => set((s) => {
                const flights = [...s.flightState.flights];
                if (!flights[index]) return s;
                flights[index] = { ...flights[index], ...segment };
                // Round-trip auto-sync
                if (s.flightState.tripType === 'round-trip' && index === 0 && flights[1]) {
                    if (segment.origin) flights[1].destination = segment.origin;
                    if (segment.destination) flights[1].origin = segment.destination;
                }
                // Date order enforcement
                if (segment.date) {
                    for (let i = index + 1; i < flights.length; i++) {
                        if (flights[i].date && flights[i].date! < segment.date!) flights[i].date = segment.date;
                    }
                    for (let i = index - 1; i >= 0; i--) {
                        if (flights[i].date && flights[i].date! > segment.date!) flights[i].date = segment.date;
                    }
                }
                return { flightState: { ...s.flightState, flights } };
            }),

            addFlightSegment: () => set((s) => {
                if (s.flightState.flights.length >= 4) return s;
                const lastDate = s.flightState.flights[s.flightState.flights.length - 1]?.date;
                return {
                    flightState: {
                        ...s.flightState,
                        flights: [
                            ...s.flightState.flights,
                            { id: Math.random().toString(), origin: null, destination: null, date: lastDate ?? null },
                        ],
                    },
                };
            }),

            removeFlightSegment: (index) => set((s) => {
                if (s.flightState.flights.length <= 1) return s;
                return {
                    flightState: {
                        ...s.flightState,
                        flights: s.flightState.flights.filter((_, i) => i !== index),
                    },
                };
            }),

            setFlightPassengers: (passengers) => set((s) => ({
                flightState: { ...s.flightState, passengers: { ...s.flightState.passengers, ...passengers } },
            })),

            reset: () => set({
                destination: null,
                destinationQuery: '',
                dates: initialDates,
                travelers: initialTravelers,
                activeDropdown: null,
                filters: initialFilters,
                isMobileFiltersOpen: false,
                suggestions: { items: [], loading: false },
                flightState: initialFlightState,
            }),
        }),
        {
            name: 'cheapestgo-search-v2',
            storage: {
                getItem: (name) => {
                    if (typeof window === 'undefined') return null;
                    const str = localStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (name, value) => {
                    if (typeof window !== 'undefined') localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    if (typeof window !== 'undefined') localStorage.removeItem(name);
                },
            },
            partialize: (s) => ({
                recentSearches: s.recentSearches,
                destination: s.destination,
                destinationQuery: s.destinationQuery,
                userCurrency: s.userCurrency,
                userCountry: s.userCountry,
                searchMode: s.searchMode,
                flightState: s.flightState,
            }) as SearchState,
        }
    )
);

// ─── Selector hooks ────────────────────────────────────────────────────────────
export const useDestination = () => useSearchStore((s) => s.destination);
export const useDestinationQuery = () => useSearchStore((s) => s.destinationQuery);
export const useUserCurrency = () => useSearchStore((s) => s.userCurrency);
export const useUserCountry = () => useSearchStore((s) => s.userCountry);
export const useDates = () => useSearchStore((s) => s.dates);
export const useTravelers = () => useSearchStore((s) => s.travelers);
export const useRecentSearches = () => useSearchStore((s) => s.recentSearches);
export const useActiveDropdown = () => useSearchStore((s) => s.activeDropdown);
export const useIsSearching = () => useSearchStore((s) => s.isSearching);
export const useSearchMode = () => useSearchStore((s) => s.searchMode);
export const useFlightState = () => useSearchStore((s) => s.flightState);
export const useSearchFilters = () => useSearchStore((s) => s.filters);
