import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { HtmlLang } from '../HtmlLang';
import { switchLocale } from '../localeTransition';

/**
 * `<html lang>` follows the language on screen.
 *
 * The root layout writes it on the server, and a client-side language switch never renders the
 * root layout again — so after a switch to Korean the page announced itself as English to screen
 * readers, translation prompts and hyphenation. The locale layout re-renders on a switch, and
 * this is how it reaches the document element. Its render is also what ends the cross-fade's
 * hold: the new language is on screen.
 */

const inLocale = (locale: string) => (
    <NextIntlClientProvider locale={locale} messages={{}}>
        <HtmlLang />
    </NextIntlClientProvider>
);

afterEach(() => {
    document.documentElement.lang = '';
    delete (document as { startViewTransition?: unknown }).startViewTransition;
});

describe('HtmlLang', () => {
    it('puts the rendered language on the document', () => {
        const { rerender } = render(inLocale('ko'));
        expect(document.documentElement.lang).toBe('ko');

        rerender(inLocale('ja'));
        expect(document.documentElement.lang).toBe('ja');
    });

    it('lets a language switch fade once the new language is on screen', async () => {
        let updateDone: Promise<void> | void = undefined;
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true, writable: true,
            value: vi.fn((update: () => Promise<void> | void) => { updateDone = update(); return {}; }),
        });
        window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
        let released = false;

        switchLocale('ko', () => {});
        void Promise.resolve(updateDone).then(() => { released = true; });
        render(inLocale('ko'));
        await Promise.resolve(); await Promise.resolve();

        expect(released).toBe(true);
    });
});
