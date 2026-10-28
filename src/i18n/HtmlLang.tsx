'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { markLocaleRendered } from './localeTransition';

/**
 * Keeps `<html lang>` on the language being shown, and tells a language switch it has landed.
 *
 * The root layout writes `lang` on the server, but sits above the [locale] segment and is not
 * rendered again by a client-side switch — this lives in the locale layout, which is. Running
 * after the commit is also what makes it the right signal for the cross-fade in
 * `localeTransition`: the new language is on screen.
 */
export function HtmlLang(): null {
    const locale = useLocale();

    useEffect(() => {
        document.documentElement.lang = locale;
        markLocaleRendered(locale);
    }, [locale]);

    return null;
}
