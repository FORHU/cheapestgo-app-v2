import type { Metadata } from 'next';
import { Plane } from 'lucide-react';
import { Header } from '@/shared/components/header';
import { TripsList } from '@/features/trips/components/trips-list';

export const metadata: Metadata = {
    title: 'My Trips',
    robots: { index: false, follow: false },
};

export default function TripsPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Plane className="text-blue-600" size={28} />
                        My Trips
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        View and manage all your bookings.
                    </p>
                </div>
                <TripsList />
            </main>
        </div>
    );
}
