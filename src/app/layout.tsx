import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { JetBrains_Mono, Fredoka, Open_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Providers } from '@/shared/components/providers';
import { AuthListener } from '@/shared/auth/AuthListener';
import { ExchangeRateListener } from '@/shared/components/ExchangeRateListener';
import { GlobalSparkle } from '@/shared/components/ui/GlobalSparkle';
import { MobileBottomNav } from '@/shared/components/common/MobileBottomNav';
import { ScrollToTop } from '@/shared/components/common/ScrollToTop';
import { brandProfile, brandPreviewEnabled } from '@/shared/lib/brand';
import { getBrandName } from '@/shared/lib/brand.server';
import { BrandProvider } from '@/shared/components/BrandProvider';
import { BrandPreviewSwitcher } from '@/shared/components/BrandPreviewSwitcher';
import InstallPWAPrompt from '@/shared/components/pwa/InstallPWAPrompt';
import PWAServiceWorkerRegistrar from '@/shared/components/pwa/PWAServiceWorkerRegistrar';

// Plus Jakarta Sans is the app-wide typeface: one variable family covering the
// 400–800 range, carrying both body and display weights (see globals.css, which
// binds --font-sans and --font-display to it). JetBrains Mono stays reserved for
// prices, times and durations so numeric columns keep their tabular alignment.
const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    variable: '--font-plus-jakarta',
    display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'optional' });
const fredoka = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-fredoka' });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-jakarta' });

// The landing page is the only surface on Open Sans — it rebinds --font-sans and
// --font-display to this variable on its own root (see src/app/page.tsx).
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cheapestgo.com';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

// Every string below names the brand. Served from the Korean domain under a literal
// "CheapestGo" the tab title, the share card and the app name all name a company the
// visitor has never heard of — and a share card is the one surface a visitor sees
// before they ever reach the site.
//
// Per request rather than a constant: a deployment with the brand preview on shows
// whichever brand the visitor picked, and the tab title has to be that one.
export async function generateMetadata(): Promise<Metadata> {
    const brand = await getBrandName();
    const { favicon, logo } = brandProfile(brand);
    const tagline = `${brand} | Discover and Book Your Next Global Journey`;
    const description = `Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with ${brand} — your modern travel OS.`;

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: tagline,
            template: `%s | ${brand}`,
        },
        description,
        icons: {
            icon: favicon,
            apple: favicon,
        },
        appleWebApp: {
            capable: true,
            statusBarStyle: 'black-translucent',
            title: brand,
        },
        openGraph: {
            title: tagline,
            description,
            url: SITE_URL,
            siteName: brand,
            images: [{
                url: `${SITE_URL}${logo}`,
                width: 1200,
                height: 630,
                alt: `${brand} - Ultimate Travel Booking Platform`,
            }],
            locale: 'en_US',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: tagline,
            description,
            images: [`${SITE_URL}${logo}`],
        },
    };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();
    const brand = await getBrandName();

    return (
        <html lang={locale} suppressHydrationWarning>
            <body className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} ${fredoka.variable} ${plusJakarta.variable} ${openSans.variable} font-sans`}>
                {/* Puts the saved theme on <html> before the first paint.
                    ThemeProvider reads the class back rather than localStorage,
                    so this is what carries a dark-mode reader through a reload
                    without the page flashing light first. Blocking on purpose:
                    anything deferred paints after the flash it is meant to
                    prevent. Defaults to light, as the app always has. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: "try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t==='dark'?'dark':'light')}catch(e){document.documentElement.classList.add('light')}",
                    }}
                />
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <BrandProvider name={brand}>
                    <Providers>
                        <AuthListener />
                        <ExchangeRateListener />
                        {/* The two class hooks are for screens that own the whole
                            viewport and want none of this — the page grid, the
                            100vh floor, the nav inset. They cannot be dropped
                            here with a route test, because this is a server
                            component and one of them (the search page's map view
                            against its list view) is a matter of client state.
                            See `.map-immersive` in globals.css. */}
                        <div className="app-shell relative min-h-screen w-full bg-alabaster dark:bg-obsidian text-slate-900 dark:text-white transition-colors bg-grid-alabaster dark:bg-grid-obsidian bg-size-40px_40px">
                            <GlobalSparkle />
                            {/* Room under the page for the bottom nav — 80px of
                                bar plus its safe-area inset, plus air. A flat
                                pb-24 came up short on a phone with a home
                                indicator even before the nav grew. */}
                            <div className="app-shell-main relative flex flex-col flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] lg:pb-0">
                                {children}
                            </div>
                            <ScrollToTop />
                            <MobileBottomNav />
                            <InstallPWAPrompt />
                        </div>
                        <PWAServiceWorkerRegistrar />
                        {/* Only where the brand preview is on. On production the control is
                            never rendered, so there is nothing to find or to switch. */}
                        {brandPreviewEnabled() && <BrandPreviewSwitcher current={brand} />}
                    </Providers>
                    </BrandProvider>
                </NextIntlClientProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
