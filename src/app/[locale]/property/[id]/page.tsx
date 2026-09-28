import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PropertyView } from '@/features/hotels/components/property-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/** The hotel's own name, for the tab and the search result. Absent, the page falls back. */
async function hotelName(id: string): Promise<string | null> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    try {
        const res = await fetch(`${base}/hotels/property/${id}`, {
            signal: AbortSignal.timeout(4000),
            next:   { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const body = await res.json() as { content?: { name?: string } };
        return body.content?.name ?? null;
    } catch {
        return null;
    }
}

/**
 * One indexable page per hotel, so this is where per-language indexing is won or lost: a
 * page can render in perfect Korean and still hand Google an English canonical, and a
 * canonical is one of the two things a search result is built from.
 *
 * The other is the title, which until now was the site-wide English default — every hotel
 * page in every language claimed the same one.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const [name, t] = await Promise.all([hotelName(id), getTranslations('property')]);

    return {
        ...(name && {
            title:       name,
            description: t('metaDescription', { name }),
        }),
        alternates: await hreflangAlternates(`/property/${id}`),
    };
}

export default function HotelPropertyPage() {
    return <PropertyView />;
}
