import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/shared/components/header';
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

export default async function TripDetailPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <BookingDetail id={id} />
        </div>
    );
}
