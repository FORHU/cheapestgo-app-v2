import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getBrandName } from '@/shared/lib/brand.server';
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

    const t = await getTranslations('flights.meta');
    const brand = await getBrandName();

    const title = origin && destination
        ? t('titleRoute', { origin, destination })
        : t('title');

    const description = origin && destination
        ? t('descriptionRoute', { origin, destination, brand })
        : t('description', { brand });

    return {
        title,
        description,
        robots: { index: false, follow: false },
        alternates: { canonical: '/flights/search' },
    };
}

export default function FlightSearchPage() {
    return (
        // No app header: the results page's own top bar stands in for it, as the hotel
        // search page's does — see FlightSearchTopBar.
        <div className="min-h-screen flex flex-col">
            <Suspense fallback={null}>
                <FlightSearchClient />
            </Suspense>
        </div>
    );
}

