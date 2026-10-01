import { MetadataRoute } from 'next';
import { POPULAR_DESTINATIONS } from '@/shared/lib/destinations';
import { servedLocalePaths } from '@/shared/lib/seo';

/**
 * Every public page, once per language.
 *
 * This is what makes per-language indexing real: internal links carry the
 * locale prefix (see i18n/navigation), and the sitemap gives a crawler a
 * prefixed entry point for each page so it never has to find one by guessing.
 *
 * One entry per locale this deployment actually serves — so AirangGo lists its Korean pages
 * only, and CheapestGo lists English, Japanese and Chinese. That list comes from
 * `@/shared/lib/seo`, the same one the pages build their canonical and alternate URLs from.
 * Keeping a second copy here is how v1 came to advertise a `/ko` its own pages no longer
 * claimed.
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
    return servedLocalePaths(path).map(({ path: at }): Entry => ({
        url:             `${baseUrl}${at}` || `${baseUrl}/`,
        lastModified:    now,
        changeFrequency: opts?.changeFrequency ?? 'weekly',
        priority:        opts?.priority ?? 0.7,
    }));
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
