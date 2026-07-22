import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FlightSearchClient } from './flight-search-client';
import { Header } from '@/shared/components/header';

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
        ? `Flights ${origin} → ${destination} | CheapestGo`
        : 'Flight Search Results | CheapestGo';

    const description = origin && destination
        ? `Compare and book the cheapest flights from ${origin} to ${destination}. Find the best deals on CheapestGo.`
        : 'Compare and book cheap flights worldwide. Find the best deals on CheapestGo.';

    return {
        title,
        description,
        robots: { index: false, follow: false },
        alternates: { canonical: '/flights/search' },
    };
}

export default function FlightSearchPage() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <Suspense fallback={null}>
                <FlightSearchClient />
            </Suspense>
        </div>
    );
}

