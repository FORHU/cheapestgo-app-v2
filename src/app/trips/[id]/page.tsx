import type { Metadata } from 'next';
import { Header } from '@/shared/components/header';
import { BookingDetail } from '@/features/trips/components/booking-detail';

export const metadata: Metadata = {
    title: 'Booking Details',
    robots: { index: false, follow: false },
};

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
