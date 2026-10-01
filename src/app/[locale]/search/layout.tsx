import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * The search page is a Client Component, which cannot export metadata — so its tab title lives
 * here. Without it the page fell through to the root layout's one fixed English string.
 */
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('search');
    return {
        title:  t('metaTitle'),
        robots: { index: false, follow: false },
    };
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children;
}
