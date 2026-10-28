import React from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing, isLocale } from '@/i18n/routing';
import { HtmlLang } from '@/i18n/HtmlLang';
import { SupportWidget } from '@/features/support/components/SupportWidget';
import { MobileBottomNav } from '@/shared/components/common/MobileBottomNav';
import { ScrollToTop } from '@/shared/components/common/ScrollToTop';
import InstallPWAPrompt from '@/shared/components/pwa/InstallPWAPrompt';
import { LoginModal } from '@/features/auth/components/login-modal';

/**
 * Everything the visitor sees lives under this segment. /admin does not: it is
 * staff-facing and English-only, so it stays at app/admin and is skipped by the
 * locale middleware.
 *
 * The chrome - html, body, fonts, providers - is in the root layout above this
 * one, which reads the resolved locale through next-intl rather than from a
 * route param, so /admin renders correctly without a segment of its own.
 *
 * The translations are not part of that chrome: they are provided here, along
 * with every piece of shell that shows text. Changing language is a client-side
 * navigation from /deals to /ko/deals, and a navigation renders again only from
 * the segment that changed - this one. Provided from the root layout, the
 * address changed while every string stayed in the old language.
 */

export function generateStaticParams() {
    return routing.locales.map(locale => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // An unknown prefix is a 404, not a silent fall back to English: /de/deals
    // should not quietly serve the English page under a German URL, because a
    // crawler would then index the same content at an address we do not support.
    if (!isLocale(locale)) notFound();

    // Opts this subtree into static rendering. Without it every page under the
    // segment is forced dynamic, which is most of what the segment buys us.
    setRequestLocale(locale);

    // The provider takes this request's locale and messages from src/i18n/request.ts.
    //
    // SupportWidget is on every page under the segment, because a customer needs support
    // from wherever they got stuck — mid-checkout most of all. It renders nothing for a
    // signed-out visitor (ADR-0032), so it costs a marker element and no more. The rest is
    // the app shell's translated chrome; each piece positions itself, so living here rather
    // than beside the root layout's page wrapper does not move it.
    return (
        <NextIntlClientProvider>
            <HtmlLang />
            {children}
            <SupportWidget />
            <ScrollToTop />
            <MobileBottomNav />
            <InstallPWAPrompt />
            <LoginModal />
        </NextIntlClientProvider>
    );
}
