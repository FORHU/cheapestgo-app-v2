import React from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { routing, isLocale } from '@/i18n/routing';

/**
 * Everything the visitor sees lives under this segment. /admin does not: it is
 * staff-facing and English-only, so it stays at app/admin and is skipped by the
 * locale middleware.
 *
 * The chrome - html, body, fonts, providers - is in the root layout above this
 * one, which reads the resolved locale through next-intl rather than from a
 * route param, so /admin renders correctly without a segment of its own.
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

    return <>{children}</>;
}
