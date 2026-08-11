export const revalidate = 300;

import Link from 'next/link';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { ImmersiveSearchBar } from '@/features/search/components/immersive-search-bar';
import { YourRecentSearches } from '@/shared/components/landing/YourRecentSearches';
import RecentlyViewed from '@/shared/components/landing/RecentlyViewed';
import PhilippinesCitiesSection from '@/shared/components/landing/PhilippinesCitiesSection';
import AsiaPacificAttractionsSection from '@/shared/components/landing/AsiaPacificAttractionsSection';
import { PopularDestinationsSection } from '@/shared/components/landing/PopularDestinationsSection';
import { HowItWorksSection } from '@/shared/components/landing/HowItWorksSection';
import AppBanner from '@/shared/components/landing/AppBanner';
import { SectionSkeleton, DealsSectionStream } from './_sections';

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

            {/* Hero — Immersive search bar */}
            <section className="relative w-full px-4 pt-24 pb-20">
                <ImmersiveSearchBar />
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
