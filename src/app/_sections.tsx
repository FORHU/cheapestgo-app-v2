import DealsSection from '@/shared/components/landing/DealsSection';
import { getFlightDeals } from '@/lib/server/landing/get-landing-data';

export function SectionSkeleton() {
    return (
        <div className="w-full py-4 md:py-8 px-4 sm:px-6">
            <div className="max-w-[1400px] mx-auto space-y-4">
                <div className="h-7 w-52 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="shrink-0 w-[220px] sm:w-[260px] md:w-[320px] aspect-3/2 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export async function DealsSectionStream() {
    const deals = await getFlightDeals();
    return <DealsSection deals={deals} />;
}
