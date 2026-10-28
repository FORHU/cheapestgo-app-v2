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
 */
export function flightCheckoutQuery(
    offer: FlightOffer,
    travellers: { adults: number; children: number; infants: number },
    bundleHotelId?: string | null,
    /** The currency the traveller is looking at; the airline's own when left out. */
    displayCurrency?: string | null,
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
    return qs;
}
