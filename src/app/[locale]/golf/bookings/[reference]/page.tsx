import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GolfBookingView } from '@/features/golf/components/golf-booking-view';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('golf.booking');
    return {
        title:  t('yourBooking'),
        robots: { index: false, follow: false },
    };
}

export default async function GolfBookingPage({ params }: { params: Promise<{ reference: string }> }) {
    const { reference } = await params;
    return <GolfBookingView reference={reference} />;
}
