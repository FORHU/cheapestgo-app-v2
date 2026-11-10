import type { FlightOffer } from '@/shared/types';

/**
 * The query string a chosen flight goes to checkout with.
 *
 * Checkout reads the trip from the URL, never from sessionStorage: with the offer id alone it
 * drew an empty route and a USD 0 total. The server still prices the booking from the offer;
 * these are what the page shows meanwhile.
 *
 * The travellers too, all of them. The offer holds one passenger per traveller searched for,
 * adults then children then infants, and the order must name each one — a checkout that only
 * knew the adults sent the airline too few, and the order was refused after the card.
 *
 * Two currencies travel: `currency` is the one the page opens in — the traveller's own, so the
 * checkout agrees with the selector in its toolbar — and `fareCurrency` is the one `totalAmount`
 * is written in, the airline's. Without the second, picking a currency would relabel the fare.
 *
 * The search the flight was picked from travels too, as `search`, so a checkout whose fare has
 * gone can run it again (`fareGoneSearchHref`). The checkout's own route is no stand-in: it is
 * the airports of this one offer, not the "Tokyo" the traveller typed, and has no return date.
 */
export function flightCheckoutQuery(
    offer: FlightOffer,
    travellers: { adults: number; children: number; infants: number },
    bundleHotelId?: string | null,
    /** The currency the traveller is looking at; the airline's own when left out. */
    displayCurrency?: string | null,
    /** The results page's query string. */
    search?: string | null,
): URLSearchParams {
    const qs = new URLSearchParams();
    qs.set('offerId', offer.offerId);
    const first = offer.segments?.[0];
    const last  = offer.segments?.[offer.segments.length - 1];
    qs.set('totalAmount', String(offer.price?.total ?? 0));
    const fareCurrency = offer.price?.currency ?? 'USD';
    qs.set('currency', displayCurrency || fareCurrency);
    qs.set('fareCurrency', fareCurrency);
    if (first?.origin)          qs.set('origin', first.origin);
    if (last?.destination)      qs.set('destination', last.destination);
    if (first?.departure?.time) qs.set('departureDate', first.departure.time.slice(0, 10));
    if (first?.cabinClass)      qs.set('cabin', first.cabinClass);
    qs.set('adults', String(travellers.adults));
    if (travellers.children > 0) qs.set('children', String(travellers.children));
    if (travellers.infants > 0)  qs.set('infants', String(travellers.infants));
    if (bundleHotelId)           qs.set('bundleHotelId', bundleHotelId);
    if (search) {
        // The note that an earlier fare had gone belongs to that visit, not to the next one.
        const carried = new URLSearchParams(search);
        carried.delete(FARE_GONE_PARAM);
        const rest = carried.toString();
        if (rest) qs.set('search', rest);
    }
    return qs;
}

/** On the results page: the traveller was sent back because the fare they picked had gone. */
export const FARE_GONE_PARAM = 'fareGone';

/**
 * Where a checkout sends the traveller once its fare has gone: the search they picked it from,
 * run again — a new search, so new offers — with a note saying why they are back.
 *
 * A link without that search (one opened before the checkout carried it) searches the route and
 * day it does have; one without even a route goes home. Only ever `/flights/search` or `/`,
 * whatever `search` holds: it is read as a query string and written back as one.
 */
export function fareGoneSearchHref(checkout: URLSearchParams): string {
    let qs: URLSearchParams;
    const carried = checkout.get('search');
    if (carried) {
        qs = new URLSearchParams(carried);
    } else {
        const origin = checkout.get('origin');
        const destination = checkout.get('destination');
        if (!origin || !destination) return '/';
        qs = new URLSearchParams({ origin, destination });
        const depart = checkout.get('departureDate');
        if (depart) qs.set('depart', depart);
        for (const key of ['adults', 'children', 'infants', 'cabin', 'bundleHotelId']) {
            const value = checkout.get(key);
            if (value) qs.set(key, value);
        }
    }
    qs.set(FARE_GONE_PARAM, '1');
    return `/flights/search?${qs.toString()}`;
}
