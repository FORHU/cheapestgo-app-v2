import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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

    const t = await getTranslations('flights.meta');

    const title = origin && destination
        ? t('titleRoute', { origin, destination })
        : t('title');

    const description = origin && destination
        ? t('descriptionRoute', { origin, destination, brand: BRAND_NAME })
        : t('description', { brand: BRAND_NAME });

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

