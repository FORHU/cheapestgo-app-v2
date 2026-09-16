import type { Metadata } from 'next';
import { BRAND_NAME } from '@/shared/lib/brand';
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
        ? `Flights ${origin} → ${destination} | ${BRAND_NAME}`
        : `Flight Search Results | ${BRAND_NAME}`;

    const description = origin && destination
        ? `Compare and book the cheapest flights from ${origin} to ${destination}. Find the best deals on ${BRAND_NAME}.`
        : `Compare and book cheap flights worldwide. Find the best deals on ${BRAND_NAME}.`;

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

