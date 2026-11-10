import { describe, it, expect } from 'vitest';
import { flightCheckoutQuery, fareGoneSearchHref } from '../flight-checkout-query';
import type { FlightOffer } from '@/shared/types';

const offer = {
    offerId: 'off_1',
    price: { total: 250, currency: 'USD' },
    segments: [
        { origin: 'MNL', destination: 'HND', departure: { time: '2026-12-01T08:00:00' }, cabinClass: 'economy' },
        { origin: 'HND', destination: 'NRT', departure: { time: '2026-12-01T15:00:00' } },
    ],
} as unknown as FlightOffer;

describe('flightCheckoutQuery', () => {
    it('carries the trip the checkout draws while the server prices it', () => {
        const qs = flightCheckoutQuery(offer, { adults: 1, children: 0, infants: 0 });
        expect(Object.fromEntries(qs)).toEqual({
            offerId: 'off_1', totalAmount: '250', currency: 'USD', fareCurrency: 'USD',
            origin: 'MNL', destination: 'NRT', departureDate: '2026-12-01', cabin: 'economy', adults: '1',
        });
    });

    it('carries the children and infants the offer was priced for, so checkout asks for every traveller', () => {
        // The offer holds one passenger per traveller searched for. A checkout that only knew
        // the adults sent the airline too few, and the order was refused after the card.
        const qs = flightCheckoutQuery(offer, { adults: 2, children: 1, infants: 1 });
        expect(qs.get('adults')).toBe('2');
        expect(qs.get('children')).toBe('1');
        expect(qs.get('infants')).toBe('1');
    });

    it('opens checkout in the currency the traveller picked, and names the fare\'s own beside it', () => {
        // `totalAmount` is the airline's figure and has to stay named for its own currency; the
        // currency the page opens in is the one the selector shows.
        const qs = flightCheckoutQuery(offer, { adults: 1, children: 0, infants: 0 }, null, 'KRW');
        expect(qs.get('currency')).toBe('KRW');
        expect(qs.get('fareCurrency')).toBe('USD');
        expect(qs.get('totalAmount')).toBe('250');
    });

    it('carries a bundled hotel', () => {
        expect(flightCheckoutQuery(offer, { adults: 1, children: 0, infants: 0 }, 'h1').get('bundleHotelId')).toBe('h1');
    });
});

describe('the search a flight was picked from', () => {
    const SEARCH = 'origin=Tokyo&destination=MNL&depart=2026-12-01&return=2026-12-08&tripType=round-trip&cabin=economy&adults=2&children=0&infants=0';

    it('goes to checkout with the flight, as the results page had it', () => {
        const qs = flightCheckoutQuery(offer, { adults: 2, children: 0, infants: 0 }, null, null, SEARCH);
        expect(qs.get('search')).toBe(SEARCH);
    });

    it('leaves behind the note that an earlier fare had gone', () => {
        const qs = flightCheckoutQuery(offer, { adults: 1, children: 0, infants: 0 }, null, null, `${SEARCH}&fareGone=1`);
        expect(qs.get('search')).toBe(SEARCH);
    });

    it('is left out when there is none', () => {
        expect(flightCheckoutQuery(offer, { adults: 1, children: 0, infants: 0 }).has('search')).toBe(false);
    });
});

describe('fareGoneSearchHref', () => {
    const at = (query: Record<string, string>) => {
        const href = fareGoneSearchHref(new URLSearchParams(query));
        const [path, qs = ''] = href.split('?');
        return { path, params: Object.fromEntries(new URLSearchParams(qs)) };
    };

    it('runs the traveller\'s own search again — return date, city names and all — and says why', () => {
        const { path, params } = at({
            offerId: 'off_1', origin: 'NRT', destination: 'MNL',
            search: 'origin=Tokyo&destination=MNL&depart=2026-12-01&return=2026-12-08&tripType=round-trip&adults=2',
        });
        expect(path).toBe('/flights/search');
        expect(params).toEqual({
            origin: 'Tokyo', destination: 'MNL', depart: '2026-12-01', return: '2026-12-08',
            tripType: 'round-trip', adults: '2', fareGone: '1',
        });
    });

    it('searches the checkout\'s own route and day when the link carries no search', () => {
        const { path, params } = at({
            offerId: 'off_1', origin: 'MNL', destination: 'NRT', departureDate: '2026-12-01',
            adults: '1', children: '1', cabin: 'business', bundleHotelId: 'h1', currency: 'USD', totalAmount: '250',
        });
        expect(path).toBe('/flights/search');
        expect(params).toEqual({
            origin: 'MNL', destination: 'NRT', depart: '2026-12-01',
            adults: '1', children: '1', cabin: 'business', bundleHotelId: 'h1', fareGone: '1',
        });
    });

    it('goes home when there is no route to search', () => {
        expect(fareGoneSearchHref(new URLSearchParams({ offerId: 'off_1' }))).toBe('/');
    });
});
