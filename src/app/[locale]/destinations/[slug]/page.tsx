import type { Metadata } from 'next';
import { DestinationView } from '@/features/destinations/components/destination-view';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * A server route file, so the page can name the URL it is actually served at — prefix
 * included. Without it the Japanese and Chinese copies both claim to be the English page.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    return { alternates: await hreflangAlternates(`/destinations/${slug}`) };
}

export default function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
    return <DestinationView params={params} />;
}
