import type { DestinationSuggestion } from '@/features/search/api/destinations.api';

/**
 * Where flights mode starts, before anything is typed: the airports most of the traffic
 * flies from and to, Manila first. Stays mode starts from destination cards instead —
 * a city is a fine place to stay but not something a flight can be booked to.
 *
 * Shared by the landing search and the flight results page's top bar, so an empty
 * airport field offers the same list wherever it is opened.
 */
const airport = (code: string, city: string, name: string, country: string): DestinationSuggestion =>
    ({ type: 'airport', title: `${city} (${code})`, subtitle: `${name} · ${country}`, code, countryCode: '' });

export const POPULAR_AIRPORTS: DestinationSuggestion[] = [
    airport('MNL', 'Manila',    'Ninoy Aquino International Airport', 'Philippines'),
    airport('ICN', 'Seoul',     'Incheon International Airport',      'South Korea'),
    airport('NRT', 'Tokyo',     'Narita International Airport',       'Japan'),
    airport('KIX', 'Osaka',     'Kansai International Airport',       'Japan'),
    airport('SIN', 'Singapore', 'Singapore Changi Airport',           'Singapore'),
    airport('BKK', 'Bangkok',   'Suvarnabhumi Airport',               'Thailand'),
    airport('HKG', 'Hong Kong', 'Hong Kong International Airport',    'Hong Kong'),
    airport('DPS', 'Bali',      'Ngurah Rai International Airport',   'Indonesia'),
];
