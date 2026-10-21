import { useEffect, useState } from 'react';
import { http } from '@/shared/lib/http';
import type { FlightOffer } from '@/shared/types';

/**
 * The offer being bought, fetched once for the confirmation screen's itinerary — terminals,
 * airport names, duration, baggage, fare terms — none of which the checkout's own URL carries.
 *
 * Purely cosmetic: by the time this is called the booking has already succeeded, so a slow or
 * failed fetch is never retried and never blocks anything — it just leaves the receipt showing
 * the route and date it already had, without the rest of the itinerary.
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
