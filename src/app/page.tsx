export const revalidate = 300;

import { Suspense } from 'react';
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

            {/* Hero — Immersive search bar */}
            <section className="relative w-full px-4 pt-24 pb-20">
                <ImmersiveSearchBar />
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
