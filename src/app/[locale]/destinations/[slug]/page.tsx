import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DestinationView } from '@/features/destinations/components/destination-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/** `hong-kong` in the URL, "Hong Kong" in the tab title. */
const titleCase = (slug: string) =>
    slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * A server route file, so the page can name the URL it is actually served at — prefix
 * included. Without it the Japanese and Chinese copies both claim to be the English page.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const t = await getTranslations('destinations');
    return {
        title:      t('metaTitle', { place: titleCase(slug) }),
        alternates: await hreflangAlternates(`/destinations/${slug}`),
    };
}

export default function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
    return <DestinationView params={params} />;
}
