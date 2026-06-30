import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FlightSearchClient } from './flight-search-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
    const sp = await searchParams;
    const origin = (sp.origin as string) ?? '';
    const destination = (sp.destination as string) ?? '';

    const title = origin && destination
        ? `Flights ${origin} → ${destination}`
        : 'Flight Search Results';

    return {
        title,
        robots: { index: false, follow: false },
    };
}

export default function FlightSearchPage() {
    return (
        <Suspense fallback={null}>
            <FlightSearchClient />
        </Suspense>
    );
}
