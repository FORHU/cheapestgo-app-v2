import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GolfListView } from '@/features/golf/components/golf-list-view';
import { hreflangAlternates } from '@/shared/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('golf');
    return {
        title:       t('metaTitle'),
        description: t('metaDescription'),
        alternates:  await hreflangAlternates('/golf'),
    };
}

/** The country filter is read here, on the server, so the view needs no Suspense for search params. */
export default async function GolfPage({ searchParams }: { searchParams: Promise<{ country?: string | string[] }> }) {
    const { country } = await searchParams;
    const only = typeof country === 'string' && country.trim() ? country.trim() : undefined;
    return <GolfListView country={only} />;
}
