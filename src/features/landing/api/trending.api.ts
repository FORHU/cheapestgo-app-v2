import type { TrendingDest } from '@/features/search/components/immersive-search-bar';

const TRENDING_GRADIENTS = [
    'bg-gradient-to-br from-teal-500 to-emerald-700',
    'bg-gradient-to-br from-blue-400 to-sky-700',
    'bg-gradient-to-br from-pink-400 to-rose-700',
    'bg-gradient-to-br from-amber-400 to-orange-700',
];

/**
 * The destinations the landing page offers before the visitor has typed anything.
 *
 * Lives beside `featured.api.ts` rather than in the page, because the page must not be the
 * thing that holds a network call: `JourneySection` is the only caller and it is deferred
 * past the prerender. Every failure resolves to "no suggestions" — the search bar works
 * without them, and a landing page that 500s because a suggestion list was unavailable is
 * the worse outcome.
 */
export async function getTrendingDestinations(): Promise<TrendingDest[]> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return [];
    try {
        const res = await fetch(`${apiBase}/hotels/trending`, {
            signal: AbortSignal.timeout(5000),
            next:   { revalidate: 300 },
        });
        if (!res.ok) return [];
        const json = await res.json() as { success: boolean; data: Array<{ city: string; countryCode: string; countryName: string; imageUrl: string }> };
        if (!json.success) return [];
        return json.data.map((d, i) => ({
            id:          d.city.toLowerCase(),
            name:        d.city,
            country:     d.countryName,
            tag:         'Trending',
            bgClass:     TRENDING_GRADIENTS[i % TRENDING_GRADIENTS.length]!,
            lat:         null,
            lng:         null,
            countryCode: d.countryCode,
            imageUrl:    d.imageUrl || null,
        }));
    } catch {
        return [];
    }
}
