export const revalidate = 300;

import Link from 'next/link';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { LandingHero } from '@/features/landing/components/hero';
import { BundlesRow, FlightDealsRow, StaysRow } from '@/features/landing/components/card-rows';
import { FaqSection } from '@/features/landing/components/faq';
import { getLandingData } from '@/features/landing/lib/landing-data';
import { flightSearchUrl, defaultTripDates } from '@/features/landing/lib/links';
import { HOME_AIRPORT } from '@/features/landing/data/catalog';

const STATS = [
    {
        figure: '0',
        title: 'Booking fees',
        body: "You pay the supplier's price. We earn from them, not from you.",
    },
    {
        figure: '900+',
        title: 'Suppliers, one search',
        body: 'Every major airline and over a million hotels, ranked by real total price.',
    },
    {
        figure: '100%',
        title: 'Of the price, up front',
        body: 'Taxes and mandatory fees are in the number before you click.',
    },
    {
        figure: '1:47',
        title: 'Search to confirmed',
        body: 'One checkout for flights and hotels, with the policy shown first.',
    },
];

export default async function HomePage() {
    const t = await getTranslations('seo');
    const { flightDeals, stays, bundles } = await getLandingData();

    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'CheapestGo',
        url: 'https://cheapestgo.com',
        logo: 'https://cheapestgo.com/icon-192.png',
        sameAs: [],
        description: t('orgDescription'),
    };

    // Mirrors exactly what <FaqSection /> renders — same translation keys.
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [1, 2, 3, 4].map((i) => ({
            '@type': 'Question',
            name: t(`faq.q${i}`),
            acceptedAnswer: { '@type': 'Answer', text: t(`faq.a${i}`) },
        })),
    };

    const dates = defaultTripDates();

    return (
        <main className="flex min-h-screen w-full flex-col">
            <Script
                id="organization-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
            />
            <Script
                id="faq-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />

            <Header />

            <div className="w-full pt-14 md:pt-20">
                <LandingHero />
            </div>

            <div className="pt-[clamp(48px,6vw,72px)]">
                <FlightDealsRow deals={flightDeals} dates={dates} />
            </div>
            <div className="pt-[clamp(40px,5vw,60px)]">
                <StaysRow stays={stays} dates={dates} />
            </div>
            <div className="pt-[clamp(40px,5vw,60px)]">
                <BundlesRow bundles={bundles} dates={dates} />
            </div>

            {/* ── Why it is cheaper ─────────────────────────────────────────── */}
            <section className="max-w-[1240px] mx-auto px-6 pt-[clamp(64px,8vw,104px)] w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                    {STATS.map((s) => (
                        <div key={s.title}>
                            <div className="font-mono font-bold text-[32px] tracking-[-0.03em] mb-2.5 text-slate-900 dark:text-white">
                                {s.figure}
                            </div>
                            <div className="font-semibold text-[15px] mb-1.5 text-slate-900 dark:text-white">
                                {s.title}
                            </div>
                            <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                                {s.body}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <FaqSection />

            {/* ── Closing CTA ───────────────────────────────────────────────── */}
            <section className="max-w-[1240px] mx-auto px-6 mt-[clamp(64px,8vw,104px)] w-full">
                <div className="rounded-3xl bg-slate-900 dark:bg-white/5 dark:border dark:border-white/10 px-8 py-[clamp(48px,7vw,88px)] flex flex-col items-center gap-5 text-center">
                    <h2 className="font-display font-semibold tracking-[-0.03em] leading-[1.1] text-[clamp(26px,3.6vw,38px)] text-white max-w-[520px]">
                        Your next trip is cheaper than you think
                    </h2>
                    <Link
                        href={flightSearchUrl({
                            origin: HOME_AIRPORT,
                            destination: 'NRT',
                            depart: dates.depart,
                            ret: dates.ret,
                            adults: 1,
                        })}
                        className="mt-1 h-12 px-7 rounded-[14px] bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center transition-colors"
                    >
                        Start a search
                    </Link>
                </div>
            </section>

            <div className="mt-[clamp(56px,7vw,88px)] w-full">
                <Footer />
            </div>
        </main>
    );
}
