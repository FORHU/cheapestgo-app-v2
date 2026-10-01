import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/features/legal/legal-page';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * Async so the canonical can name the URL this page is actually served at, and so the title
 * and body can be read in the language being served. A static `metadata` object could do
 * neither: it is evaluated without a request.
 */
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('legal.cookiePolicy');
    return {
        title:       t('title'),
        description: t('description'),
        alternates:  await hreflangAlternates('/cookies'),
    };
}

export default function Page() {
    return <LegalPage doc="cookie" titleKey="cookiePolicy" />;
}
