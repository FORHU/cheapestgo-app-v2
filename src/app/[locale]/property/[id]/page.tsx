import type { Metadata } from 'next';
import { PropertyView } from '@/features/hotels/components/property-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * One indexable page per hotel, so this is where per-language indexing is won or lost: a
 * page can render in perfect Korean and still hand Google an English canonical, and a
 * canonical is one of the two things a search result is built from.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    return { alternates: await hreflangAlternates(`/property/${id}`) };
}

export default function HotelPropertyPage() {
    return <PropertyView />;
}
