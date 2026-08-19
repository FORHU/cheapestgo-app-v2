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

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'CheapestGo | Discover and Book Your Next Global Journey',
        template: '%s | CheapestGo',
    },
    description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
    icons: {
        icon: '/Fav_Icon_Light.png',
        apple: '/Fav_Icon_Light.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'CheapestGo',
    },
    openGraph: {
        title: 'CheapestGo | Discover and Book Your Next Global Journey',
        description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
        url: SITE_URL,
        siteName: 'CheapestGo',
        images: [{
            url: `${SITE_URL}/Web_Logo_Light.png`,
            width: 1200,
            height: 630,
            alt: 'CheapestGo - Ultimate Travel Booking Platform',
        }],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'CheapestGo | Discover and Book Your Next Global Journey',
        description: 'Discover the best travel deals globally. Plan your flights and hotels easily, save money, and start exploring the world with CheapestGo — your modern travel OS.',
        images: [`${SITE_URL}/Web_Logo_Light.png`],
    },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();

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
                    </Providers>
                </NextIntlClientProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
