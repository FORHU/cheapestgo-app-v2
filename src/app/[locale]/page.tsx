export const revalidate = 300;

import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { CSSProperties } from 'react';
import { brandProfile } from '@/shared/lib/brand';
import { getBrandName } from '@/shared/lib/brand.server';
import { BRAND } from '@/shared/lib/palette';
import { hreflangAlternates } from '@/shared/lib/seo';

/**
 * The homepage names itself, per locale.
 *
 * Without this every language declared no canonical at all and the root layout could not
 * supply one — a canonical set there would name `/` for every page beneath it, so each
 * page carries its own.
 */
export async function generateMetadata(): Promise<Metadata> {
    // Without these the landing page falls through to the root layout's default, which is one
    // fixed English string — the only page in the app whose tab title never changed language.
    const t = await getTranslations('seo');
    return {
        title:       t('homeTitle'),
        description: t('homeDescription'),
        alternates:  await hreflangAlternates('/'),
    };
}
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { LandingFooter } from '@/features/landing/components/landing-footer';
import { Journey } from '@/features/landing/journey/Journey';
import { JourneySection } from '@/features/landing/journey/journey-section';

/**
 * The landing page runs on its own dark canvas and its own type stack, so it
 * overrides the two font vars `globals.css` binds to Plus Jakarta Sans on
 * `<body>` rather than changing them app-wide.
 *
 * The canvas is v1's: slate-900 falling to obsidian (`shared/lib/palette.ts`).
 * It shows wherever the video has not painted — before it loads, or if it fails.
 */
const CANVAS: CSSProperties = {
    background: BRAND.canvas,
    '--font-sans': "var(--font-open-sans), 'Open Sans', sans-serif",
    '--font-display': "var(--font-open-sans), 'Open Sans', sans-serif",
} as CSSProperties;

export default async function HomePage() {
    // Nothing here touches the network. The two calls the Journey needs live in
    // `JourneySection`, below, so neither this page nor the build waits on the API.
    const [t, brand] = await Promise.all([
        getTranslations('seo'),
        getBrandName(),
    ]);

    // The organisation the page declares is the brand being shown, at its own address. A literal
    // cheapestgo.com here told search engines that AirangGo's homepage was CheapestGo's.
    const profile = brandProfile(brand);
    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brand,
        url: profile.origin,
        logo: `${profile.origin}${profile.icon}`,
        sameAs: [],
        description: t('orgDescription'),
    };

    return (
        // `-mb-24 pb-24` swaps the layout's mobile bottom-nav gutter for one this
        // page paints itself; otherwise that strip shows the app background as a
        // pale band under the dark footer.
        <main
            className="relative -mb-24 flex min-h-screen w-full flex-col pb-24 font-sans text-[#f8fafc] lg:mb-0 lg:pb-0"
            style={CANVAS}
        >
            <Script
                id="organization-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
            />

            <LandingHeader />

            {/* The Journey stands where the looping backdrop video used to: it paints the
                fixed world behind the page and reserves the scroll distance the journey
                needs. */}
            <Suspense fallback={<Journey showcaseStays={{}} />}>
                <JourneySection />
            </Suspense>

            <div className="relative z-[1] mt-auto">
                <LandingFooter />
            </div>
        </main>
    );
}
