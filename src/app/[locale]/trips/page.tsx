import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { TripsList } from '@/features/trips/components/trips-list';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('trips');
    return {
        title:  t('myTrips'),
        robots: { index: false, follow: false },
    };
}

/**
 * My Bookings, on the flight results page's ground and in its type: the plain ground
 * (`FlatGround`), the title and count line as "Flights to Seoul" sets them, and the
 * cards in the results cards' materials.
 *
 * Under the landing page's navbar rather than the app header — the page the
 * landing's Bookings link opens, so it keeps the bar that link was in, in its
 * themed tone. The column takes that bar's measure, 1240px with its padding inside,
 * so the list starts on the same line as the logo above it.
 * No background of its own: one here would cover the ground `FlatGround` paints.
 */
export default function TripsPage() {
    const t = useTranslations('trips');
    return (
        <div className="min-h-screen flex flex-col">
            <FlatGround />
            <LandingHeader tone="default" />
            <main className="flex-1 w-full max-w-[1240px] mx-auto px-6 pt-2 pb-24 md:pt-4 md:pb-28">
                <div className="mb-5">
                    <h1 className="text-lg font-bold text-slate-900 md:text-2xl dark:text-slate-50">
                        {t('myTrips')}
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-500 md:text-sm dark:text-white/55">
                        {t('pageSubtitle')}
                    </p>
                </div>
                <TripsList />
            </main>
        </div>
    );
}
