import { useEffect, useState } from 'react';
import { http } from '@/shared/lib/http';
import type { FlightOffer } from '@/shared/types';

/**
 * The offer being bought, fetched once: the server's quote of what the card will be held for,
 * which the checkout shows before the traveller commits to anything, and the itinerary the
 * receipt draws — terminals, airport names, duration, baggage, fare terms — none of which the
 * checkout's own URL carries.
 *
 * Never blocks anything and is never retried: a slow or failed fetch leaves the checkout on the
 * fare in its link, with no fee line, and the receipt on the route and date it already had.
 */
export function useFlightOffer(offerId: string | null) {
    const [offer, setOffer]     = useState<FlightOffer | null>(null);
    const [loading, setLoading] = useState(!!offerId);

    useEffect(() => {
        if (!offerId) { setOffer(null); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        http.get<FlightOffer>(`/flights/offers/${encodeURIComponent(offerId)}`)
            .then(o => { if (!cancelled) setOffer(o); })
            .catch(() => { if (!cancelled) setOffer(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [offerId]);

    return { offer, loading };
}
