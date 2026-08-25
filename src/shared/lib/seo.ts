import { routing } from '@/i18n/routing';

/**
 * `alternates` blocks for Next's generateMetadata.
 *
 * With `localePrefix: 'as-needed'` English carries no prefix and ko/ja/zh are
 * served at /ko/*, /ja/*, /zh/*. Declaring the alternates is what tells a search
 * engine these are the same page in different languages rather than duplicates
 * competing with each other.
 *
 *   export const metadata = { alternates: hreflangAlternates('/deals') };
 */

const NON_DEFAULT_LOCALES = routing.locales.filter(l => l !== routing.defaultLocale);

/** Prefix a path for one locale. The default locale is returned unprefixed. */
export function localePath(path: string, locale: string): string {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    if (locale === routing.defaultLocale) return normalised;
    return `/${locale}${normalised === '/' ? '' : normalised}`;
}

export function hreflang(path: string): Record<string, string> {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    const out: Record<string, string> = { [routing.defaultLocale]: normalised };
    for (const locale of NON_DEFAULT_LOCALES) {
        out[locale] = localePath(normalised, locale);
    }
    // x-default is what a crawler serves to a language we do not publish.
    out['x-default'] = normalised;
    return out;
}

/** Canonical plus languages in one call, for `alternates`. */
export function hreflangAlternates(path: string) {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    return {
        canonical: normalised,
        languages: hreflang(normalised),
    };
}

export { NON_DEFAULT_LOCALES };
