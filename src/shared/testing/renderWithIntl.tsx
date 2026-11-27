import React from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/locales/en.json';

/**
 * A query client per render, so no test inherits another's cached answers.
 *
 * Retries off and no refetching: a component under test that asks for something should ask
 * once, fail once if it is going to, and say so — three silent retries turn a broken query
 * into a timeout and a `fetch` assertion into a flake.
 */
function testQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });
}

/**
 * Render a component the way the app renders it: inside the translation provider.
 *
 * And inside a query provider, for the same reason. The app has one at its root, so a
 * component is free to call `useQuery` — and when one started to, every test rendering it
 * failed with "No QueryClient set" although nothing was wrong with the component. A harness
 * that cannot render what the app renders tests the harness.
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
        <QueryClientProvider client={testQueryClient()}>
            <NextIntlClientProvider locale={locale} messages={messages}>
                {ui}
            </NextIntlClientProvider>
        </QueryClientProvider>,
        options,
    );
}

/** Wrap an existing render helper — for tests that already nest their own providers. */
export function withIntl(ui: React.ReactElement, locale = 'en') {
    return (
        <QueryClientProvider client={testQueryClient()}>
            <NextIntlClientProvider locale={locale} messages={en}>
                {ui}
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
}
