import { useEffect, useState } from 'react';
import { http } from '@/shared/lib/http';
import type { FlightOffer } from '@/shared/types';

/**
 * The offer being bought, fetched once: the server's quote of what the card will be held for,
 * which the checkout shows before the traveller commits to anything, and the itinerary the
 * receipt draws — terminals, airport names, duration, baggage, fare terms — none of which the
 * checkout's own URL carries.
 *
 * `currency` is the one the page is showing prices in. The quote is made in it, and made again
 * when it changes — the currency selector only rewrites `?currency=`, so a quote fetched once
 * stayed in the first currency whatever was picked. The offer already read stays on screen while
 * the new quote is on its way.
 *
 * Never blocks anything and is never retried: a slow or failed fetch leaves the checkout on the
 * fare in its link, with no fee line, and the receipt on the route and date it already had.
 */
export function useFlightOffer(offerId: string | null, currency?: string) {
    const [offer, setOffer]     = useState<FlightOffer | null>(null);
    const [loading, setLoading] = useState(!!offerId);

    useEffect(() => {
        if (!offerId) { setOffer(null); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        // A new currency re-quotes the offer already read; a new offer drops it.
        setOffer(o => (o?.offerId === offerId ? o : null));
        const query = currency ? `?currency=${encodeURIComponent(currency)}` : '';
        http.get<FlightOffer>(`/flights/offers/${encodeURIComponent(offerId)}${query}`)
            .then(o => { if (!cancelled) setOffer(o); })
            // A failed re-quote leaves the quote there was; the page names its currency beside
            // every figure, so it is out of date, not mislabelled.
            .catch(() => { /* see above */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [offerId, currency]);

    return { offer, loading };
}
