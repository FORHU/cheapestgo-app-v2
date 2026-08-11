export const revalidate = 300;

import type { CSSProperties } from 'react';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { ImmersiveSearchBar } from '@/features/search/components/immersive-search-bar';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { LandingFooter } from '@/features/landing/components/landing-footer';
import { LandingVideoBackdrop } from '@/features/landing/components/landing-video-backdrop';

/**
 * The landing page runs on its own dark canvas and its own type stack, so it
 * overrides the two font vars `globals.css` binds to Plus Jakarta Sans on
 * `<body>` rather than changing them app-wide.
 */
const CANVAS: CSSProperties = {
    background: 'radial-gradient(120% 80% at 50% 0%,#1f1f1f 0%,#161616 45%,#121212 100%)',
    '--font-sans': "var(--font-open-sans), 'Open Sans', sans-serif",
    '--font-display': "var(--font-open-sans), 'Open Sans', sans-serif",
} as CSSProperties;

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

            <LandingVideoBackdrop />

            <LandingHeader />

            {/* Hero — the search bar owns the whole space between header and footer,
                sitting high in it rather than centred. */}
            <section className="relative z-[1] flex flex-1 justify-center px-4 pt-[clamp(16px,3vw,40px)] pb-[clamp(48px,8vw,96px)]">
                <ImmersiveSearchBar />
            </section>

            <div className="relative z-[1]">
                <LandingFooter />
            </div>
        </main>
    );
}
