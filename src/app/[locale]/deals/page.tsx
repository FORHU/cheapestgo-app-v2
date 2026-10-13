import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DealsView } from '@/features/deals/components/deals-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * A server route file, so the page can name the URL it is actually served at — prefix
 * included. Without it the Japanese and Chinese copies both claim to be the English page.
 */
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('deals');
    return {
        title:      t('metaTitle'),
        alternates: await hreflangAlternates('/deals'),
    };
}

export default function DealsPage() {
    return <DealsView />;
}
