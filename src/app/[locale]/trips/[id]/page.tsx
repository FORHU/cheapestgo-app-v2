import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { BookingDetail } from '@/features/trips/components/booking-detail';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('trips');
    return {
        title:  t('bookingDetails'),
        robots: { index: false, follow: false },
    };
}

interface PageProps {
    params: Promise<{ id: string }>;
}

/**
 * One booking, under the bar and on the ground the bookings list has (`trips/page.tsx`) —
 * the page a card opens, so it keeps the page the card was on. No background of its own:
 * one here would cover the ground `FlatGround` paints.
 */
export default async function TripDetailPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <div className="min-h-screen flex flex-col">
            <FlatGround />
            <LandingHeader tone="default" />
            <BookingDetail id={id} />
        </div>
    );
}
