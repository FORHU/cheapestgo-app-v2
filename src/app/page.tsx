import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { SearchForm } from '@/features/search/components/search-form';
import { Plane, Hotel, Shield, Clock, Tag } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            {/* Hero */}
            <section className="relative flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center overflow-hidden">
                {/* Background gradient */}
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

            {/* Features */}
            <section className="py-16 px-4">
                <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        {
                            icon:  <Plane className="text-blue-500" size={24} />,
                            title: 'Global Flights',
                            desc:  'Search across Duffel, Mystifly, and more for the lowest fares on any route.',
                        },
                        {
                            icon:  <Hotel className="text-emerald-500" size={24} />,
                            title: 'Hotels Worldwide',
                            desc:  'Compare hotel prices with real-time availability from TravelgateX and ONDA.',
                        },
                        {
                            icon:  <Shield className="text-violet-500" size={24} />,
                            title: 'Secure Booking',
                            desc:  'End-to-end encrypted payments powered by Stripe with PNR confirmation first.',
                        },
                    ].map(f => (
                        <div key={f.title} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                                {f.icon}
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Why CheapestGo */}
            <section className="py-16 px-4 bg-white dark:bg-slate-900/50 border-y border-slate-200/60 dark:border-white/5">
                <div className="max-w-4xl mx-auto text-center space-y-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Why CheapestGo?</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        We aggregate real-time prices from multiple suppliers so you never overpay. Our AI planner designs full itineraries — with bookable flights, hotels, and activities — from a single prompt.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                        {['No hidden fees', 'Real-time prices', 'PNR before payment', 'AI trip planning', '24/7 support'].map(badge => (
                            <span key={badge} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium">
                                <Clock size={10} />
                                {badge}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
