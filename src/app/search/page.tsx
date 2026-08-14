import React, { Suspense } from 'react';
import { SearchView } from '@/features/search/components/search-view';
import { SEARCH_TOKENS } from '@/features/search/types/search.types';

export default function HotelSearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center" style={{ height: '100dvh', background: SEARCH_TOKENS.BG }}>
                    <div className="rounded-full border-2 border-t-transparent animate-spin"
                        style={{ width: 32, height: 32, borderColor: SEARCH_TOKENS.ACCENT, borderTopColor: 'transparent' }} />
                </div>
            }
        >
            <SearchView />
        </Suspense>
    );
}
