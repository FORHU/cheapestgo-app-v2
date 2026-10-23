/** The minimum a caller must name for a destination to be looked up. */
export interface ShowcasePlace {
    city: string;
    countryCode: string;
}

/**
 * The promoted stay shown for one Act. Mirrors `FeaturedStay` in api-v2.
 *
 * `price` is a figure an admin chose to promote for the dates on the deal row, not a
 * quote for the visitor's dates — the card links into a real search rather than
 * offering to book this one.
 */
export interface FeaturedStay {
    hotelCode: string | null;
    name: string;
    location: string | null;
    city: string;
    countryCode: string | null;
    price: number;
    currency: string;
    stars: number | null;
    rating: number | null;
    badge: string | null;
    images: string[];
    lat: number | null;
    lng: number | null;
    refreshedAt: string | null;
}

/**
 * Fetch the promoted stay for every Act, server-side.
 *
 * Hits `/hotels/featured`, which reads two of our own tables and never contacts a
 * supplier. That restriction is the whole reason this endpoint exists: the landing page
 * re-renders on a timer, so anything it calls runs on a schedule whether or not a visitor
 * arrived, and a scheduled supplier search is the pre-warming OTV's contract forbids.
 * See ADR 0005. Do not swap this for `/hotels/search` because it returns richer data.
 *
 * Every failure resolves to "no stay for that destination". A landing page that 500s
 * because a promotional price could not be fetched is a worse outcome than one showing no
 * price, and the Journey is built to run without them.
 */
export async function fetchActStays(
    places: readonly ShowcasePlace[],
): Promise<Record<string, FeaturedStay>> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return {};

    const entries = await Promise.all(
        places.map(async (place): Promise<[string, FeaturedStay] | null> => {
            try {
                const qs = new URLSearchParams({ city: place.city, cc: place.countryCode });
                const res = await fetch(`${apiBase}/hotels/featured?${qs}`, {
                    // Short: four of these run per render, and the page must not be held
                    // open by the slowest. The card is the first thing we give up.
                    signal: AbortSignal.timeout(4000),
                    next: { revalidate: 300 },
                });
                if (!res.ok) return null;

                const json = (await res.json()) as { stay?: FeaturedStay | null };
                // A stay with no price would render a card advertising nothing.
                if (!json.stay?.name || !(json.stay.price > 0)) return null;

                // Keyed by city so a caller can look up whichever place is on screen.
                return [place.city, json.stay];
            } catch {
                return null;
            }
        }),
    );

    return Object.fromEntries(entries.filter((e): e is [string, FeaturedStay] => e !== null));
}
