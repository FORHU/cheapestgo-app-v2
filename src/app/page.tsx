import { Tag } from 'lucide-react';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { SearchForm } from '@/features/search/components/search-form';
import { PopularDestinationsSection } from '@/shared/components/landing/PopularDestinationsSection';
import { HowItWorksSection } from '@/shared/components/landing/HowItWorksSection';

export default function HomePage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            {/* Hero */}
            <section className="relative flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-white to-transparent dark:from-blue-950/30 dark:via-slate-950 dark:to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] -z-10 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl" />

                <div className="max-w-3xl mx-auto space-y-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold tracking-wide uppercase">
                        <Tag size={11} />
                        Lowest fares guaranteed
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 dark:text-white leading-tight">
                        Find the{' '}
                        <span className="text-blue-600 dark:text-blue-400">cheapest</span>
                        {' '}flights & hotels
                    </h1>

                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                        Compare prices across hundreds of airlines and hotels in real time. Book smarter with AI-powered trip planning.
                    </p>
                </div>

                <div className="mt-10 w-full max-w-4xl mx-auto px-4">
                    <SearchForm />
                </div>
            </section>

            {/* Sections */}
            <div className="w-full">
                <PopularDestinationsSection />
                <HowItWorksSection />
            </div>

            <Footer />
        </div>
    );
}
