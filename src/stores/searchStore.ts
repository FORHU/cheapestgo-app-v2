export {
    useSearchStore,
    useDestination,
    useDestinationQuery,
    useUserCurrency,
    useUserCountry,
    useDates,
    useTravelers,
    useRecentSearches,
    useActiveDropdown,
    useIsSearching,
    useSearchMode,
    useFlightState,
    useSearchFilters,
    type Destination,
    type DateRange,
    type TravelersConfig,
    type RoomOccupancy,
} from '@/shared/stores/search.store';

import { useSearchStore } from '@/shared/stores/search.store';

export const useSearchActions = () =>
    useSearchStore((state) => ({
        setDestination: state.setDestination,
        setDestinationQuery: state.setDestinationQuery,
        setDates: state.setDates,
        setTravelers: state.setTravelers,
        setUserCurrency: state.setUserCurrency,
        setUserCountry: state.setUserCountry,
        setActiveDropdown: state.setActiveDropdown,
        setFilters: state.setFilters,
        setIsMobileFiltersOpen: state.setIsMobileFiltersOpen,
        resetFilters: state.resetFilters,
        addRecentSearch: state.addRecentSearch,
        removeRecentSearch: state.removeRecentSearch,
        clearRecentSearches: state.clearRecentSearches,
        reset: state.reset,
    }));
