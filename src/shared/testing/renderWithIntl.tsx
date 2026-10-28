import React from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

/**
 * Render a component the way the app renders it: inside the translation provider.
 *
 * A component that calls `useTranslations` throws outright without this — next-intl has no
 * silent fallback, by design, because a missing provider means every string on the screen is
 * wrong rather than one of them. So as components are wired for translation, their tests need
 * the provider too.
 *
 * English messages, and the real ones rather than a stub: a test asserting on "Available
 * Rooms" should fail if that key is deleted or renamed, which a stub would hide.
 *
 * `locale` alone only labels the provider; the words are English unless `messages` is passed too.
 * A test that has to see another language says so: `{ locale: 'ko', messages: ko }`.
 */
export function renderWithIntl(
    ui: React.ReactElement,
    { locale = 'en', messages = en, ...options }: RenderOptions & { locale?: string; messages?: typeof en } = {},
) {
    return rtlRender(
        <NextIntlClientProvider locale={locale} messages={messages}>
            {ui}
        </NextIntlClientProvider>,
        options,
    );
}

/** Wrap an existing render helper — for tests that already nest their own providers. */
export function withIntl(ui: React.ReactElement, locale = 'en') {
    return (
        <NextIntlClientProvider locale={locale} messages={en}>
            {ui}
        </NextIntlClientProvider>
    );
}
