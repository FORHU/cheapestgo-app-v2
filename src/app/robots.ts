import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

/**
 * Paths that are private, per-user, or mid-transaction are kept out of the
 * index. Each one is disallowed under every locale prefix as well as unprefixed
 * — /ko/checkout is the same page as /checkout and should be excluded too.
 */
const PRIVATE_PATHS = [
    '/admin/',
    '/api/',
    '/auth/',
    '/login',
    '/register',
    '/account',
    '/trips',
    '/checkout',
    '/flights/book',
];

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cheapestgo.com';

    const disallow = PRIVATE_PATHS.flatMap(path => [
        path,
        ...routing.locales
            .filter(l => l !== routing.defaultLocale)
            .map(locale => `/${locale}${path}`),
    ]);

    return {
        rules: [{ userAgent: '*', allow: '/', disallow }],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
