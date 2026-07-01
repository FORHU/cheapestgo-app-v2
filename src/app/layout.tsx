import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/shared/components/providers';
import { AuthListener } from '@/shared/auth/AuthListener';
import { ExchangeRateListener } from '@/shared/components/ExchangeRateListener';
import { GlobalSparkle } from '@/shared/components/ui/GlobalSparkle';
import { MobileBottomNav } from '@/shared/components/common/MobileBottomNav';
import { ScrollToTop } from '@/shared/components/common/ScrollToTop';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-display' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'optional' });

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
            <body className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} font-sans`}>
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <Providers>
                        <AuthListener />
                        <ExchangeRateListener />
                        <div className="relative min-h-screen w-full bg-alabaster dark:bg-obsidian text-slate-900 dark:text-white transition-colors duration-800 bg-grid-alabaster dark:bg-grid-obsidian bg-size-40px_40px">
                            <GlobalSparkle />
                            <div className="relative flex flex-col flex-1 pb-24 lg:pb-0">
                                {children}
                            </div>
                            <ScrollToTop />
                            <MobileBottomNav />
                        </div>
                    </Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
