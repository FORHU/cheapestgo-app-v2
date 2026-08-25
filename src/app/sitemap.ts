import { MetadataRoute } from 'next';
import { POPULAR_DESTINATIONS } from '@/shared/lib/destinations';
import { NON_DEFAULT_LOCALES, localePath } from '@/shared/lib/seo';

/**
 * Every public page, once per language.
 *
 * This is what makes per-language indexing real: internal links carry the
 * locale prefix (see i18n/navigation), and the sitemap gives a crawler a
 * prefixed entry point for each page so it never has to find one by guessing.
 *
 * Route names here are v2's, not v1's — v2 owns its own URLs (/terms, not
 * /terms-of-service). See ADR-0016.
 */

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cheapestgo.com').replace(/\/$/, '');
const now = new Date();

type Entry = MetadataRoute.Sitemap[number];

function localeVariants(
    path: string,
    opts?: { changeFrequency?: Entry['changeFrequency']; priority?: number },
): MetadataRoute.Sitemap {
    const base: Entry = {
        url:             `${baseUrl}${path === '/' ? '' : path}` || `${baseUrl}/`,
        lastModified:    now,
        changeFrequency: opts?.changeFrequency ?? 'weekly',
        priority:        opts?.priority ?? 0.7,
    };
    return [
        base,
        ...NON_DEFAULT_LOCALES.map(locale => ({
            ...base,
            url: `${baseUrl}${localePath(path, locale)}`,
        })),
    ];
}

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        ...localeVariants('/',        { changeFrequency: 'daily',   priority: 1 }),
        ...localeVariants('/deals',   { changeFrequency: 'daily',   priority: 0.9 }),

        // Legal
        ...localeVariants('/terms',   { changeFrequency: 'monthly', priority: 0.4 }),
        ...localeVariants('/privacy', { changeFrequency: 'monthly', priority: 0.4 }),
        ...localeVariants('/refund',  { changeFrequency: 'monthly', priority: 0.4 }),
        ...localeVariants('/cookies', { changeFrequency: 'monthly', priority: 0.4 }),

        // Destinations
        ...POPULAR_DESTINATIONS.flatMap(dest =>
            localeVariants(`/destinations/${dest.id}`, { changeFrequency: 'weekly', priority: 0.8 }),
        ),
    ];
}
