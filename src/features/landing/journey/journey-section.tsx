import { connection } from 'next/server';

import { Journey } from './Journey';
import { SHOWCASE_DESTINATIONS } from './stages';
import { fetchActStays } from '@/features/landing/api/featured.api';

/**
 * The Journey, with what it needs from the API.
 *
 * `connection()` is the point of this file. It says the body may not run until a request
 * exists, which takes the landing page out of `next build`'s prerender — and with it,
 * every way a build can fail because of an API it cannot reach, cannot resolve, or that
 * answers too slowly for the exporter's 60s page budget. A deploy must not depend on a
 * running API, and a timeout raised to 180s only buys time against the same dependency.
 *
 * The call stays bounded and still swallows its own failures, so this is belt and braces
 * rather than a replacement for them: the guards protect a visitor's request, this
 * protects the build.
 *
 * `next: { revalidate: 300 }` on the fetch is what keeps the supplier-free endpoint from
 * being called per visitor — the data is cached for five minutes however many requests
 * render this. See ADR 0005: it reads our own tables, never a supplier.
 */
export async function JourneySection() {
    await connection();

    const showcaseStays = await fetchActStays(SHOWCASE_DESTINATIONS);

    return <Journey showcaseStays={showcaseStays} />;
}
