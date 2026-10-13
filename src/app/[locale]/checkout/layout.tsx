import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** The checkout page is a Client Component; its tab title lives here. */
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('checkout');
    return {
        title:  t('title'),
        robots: { index: false, follow: false },
    };
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return children;
}
