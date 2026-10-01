import type { Metadata } from 'next';
import { FlightDetailView } from '@/features/flights/components/flight-detail-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * A route page names the URL it is served at, prefix included — otherwise the Japanese and
 * Chinese copies both claim to be the English one.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    return { alternates: await hreflangAlternates(`/flights/${slug}`) };
}

export default function FlightSlugPage() {
    return <FlightDetailView />;
}
