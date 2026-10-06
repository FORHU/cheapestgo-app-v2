export const revalidate = 300;

import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { BRAND_NAME } from '@/shared/lib/brand';
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
import { ImmersiveSearchBar, type TrendingDest } from '@/features/search/components/immersive-search-bar';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { LandingFooter } from '@/features/landing/components/landing-footer';
import { LandingVideoBackdrop } from '@/features/landing/components/landing-video-backdrop';

const TRENDING_GRADIENTS = [
    'bg-gradient-to-br from-teal-500 to-emerald-700',
    'bg-gradient-to-br from-blue-400 to-sky-700',
    'bg-gradient-to-br from-pink-400 to-rose-700',
    'bg-gradient-to-br from-amber-400 to-orange-700',
];

async function getServerTrending(): Promise<TrendingDest[]> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return [];
    try {
        const res = await fetch(`${apiBase}/hotels/trending`, {
            signal: AbortSignal.timeout(5000),
            next:   { revalidate: 300 },
        });
        if (!res.ok) return [];
        const json = await res.json() as { success: boolean; data: Array<{ city: string; countryCode: string; countryName: string; imageUrl: string }> };
        if (!json.success) return [];
        return json.data.map((d, i) => ({
            id:          d.city.toLowerCase(),
            name:        d.city,
            country:     d.countryName,
            tag:         'Trending',
            bgClass:     TRENDING_GRADIENTS[i % TRENDING_GRADIENTS.length]!,
            lat:         null,
            lng:         null,
            countryCode: d.countryCode,
            imageUrl:    d.imageUrl || null,
        }));
    } catch {
        return [];
    }
}

/**
 * The landing page runs on its own dark canvas and its own type stack, so it
 * overrides the two font vars `globals.css` binds to Plus Jakarta Sans on
 * `<body>` rather than changing them app-wide.
 *
 * The canvas is v1's: slate-900 falling to obsidian (`shared/lib/palette.ts`).
 * It shows wherever the video has not painted — before it loads, or if it fails.
 */
const CANVAS: CSSProperties = {
    background: 'radial-gradient(120% 80% at 50% 0%,#0f172a 0%,#0b1222 45%,#020617 100%)',
    '--font-sans': "var(--font-open-sans), 'Open Sans', sans-serif",
    '--font-display': "var(--font-open-sans), 'Open Sans', sans-serif",
} as CSSProperties;

export default async function HomePage() {
    const [t, trending] = await Promise.all([
        getTranslations('seo'),
        getServerTrending(),
    ]);

    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: `${BRAND_NAME}`,
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
                <ImmersiveSearchBar trendingDestinations={trending} />
            </section>

            <div className="relative z-[1]">
                <LandingFooter />
            </div>
        </main>
    );
}
