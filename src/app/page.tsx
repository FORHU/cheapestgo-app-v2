export const revalidate = 300;

import { Suspense } from 'react';
import Script from 'next/script';
import { Tag } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { SearchForm } from '@/features/search/components/search-form';
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

    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'CheapestGo',
        url: 'https://cheapestgo.com',
        logo: 'https://cheapestgo.com/icon-192.png',
        sameAs: [],
        description: t('orgDescription'),
    };

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            { '@type': 'Question', name: t('faq.q1'), acceptedAnswer: { '@type': 'Answer', text: t('faq.a1') } },
            { '@type': 'Question', name: t('faq.q2'), acceptedAnswer: { '@type': 'Answer', text: t('faq.a2') } },
            { '@type': 'Question', name: t('faq.q3'), acceptedAnswer: { '@type': 'Answer', text: t('faq.a3') } },
            { '@type': 'Question', name: t('faq.q4'), acceptedAnswer: { '@type': 'Answer', text: t('faq.a4') } },
        ],
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
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

            {/* Hero */}
            <section className="relative flex flex-col items-center justify-center w-full px-4 pt-24 pb-16 text-center">
                {/* Background decorative elements — overflow-hidden is scoped here so dropdowns aren't clipped */}
                <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
                    <div className="absolute inset-0 bg-linear-to-b from-blue-50 via-white to-transparent dark:from-blue-950/30 dark:via-obsidian dark:to-transparent" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-3xl mx-auto space-y-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold tracking-wide uppercase">
                        <Tag size={11} />
                        Lowest fares guaranteed
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-slate-900 dark:text-white tracking-tighter leading-[1.1] drop-shadow-sm">
                        Find the{' '}
                        <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-cyan-400 dark:from-blue-400 dark:to-cyan-300">
                            cheapest
                        </span>
                        {' '}flights &amp; hotels
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                        Compare prices across hundreds of airlines and hotels in real time. Book smarter with AI-powered trip planning.
                    </p>
                </div>

                <div className="mt-10 w-full max-w-4xl mx-auto px-4">
                    <SearchForm />
                </div>
            </section>

            {/* Sections */}
            <div className="w-full space-y-2 sm:space-y-4">
                <div className="max-w-[1400px] mx-auto w-full">
                    <YourRecentSearches />
                    <RecentlyViewed />
                    <PhilippinesCitiesSection />
                    <AsiaPacificAttractionsSection />

                    <Suspense fallback={<SectionSkeleton />}>
                        <DealsSectionStream />
                    </Suspense>

                    <PopularDestinationsSection />
                    <HowItWorksSection />
                </div>
            </div>

            <AppBanner />
            <Footer />
        </main>
    );
}
