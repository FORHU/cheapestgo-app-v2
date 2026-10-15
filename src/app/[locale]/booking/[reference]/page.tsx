import type { Metadata } from 'next';
import { BookingStatusView } from '@/features/checkout/components/booking-status-view';

// A booking reference is private to its owner and a URL to it is not for a search engine.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function BookingStatusPage() {
    return <BookingStatusView />;
}
