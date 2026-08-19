/**
 * Server-side data fetching utilities for the search page.
 * Ported from v1's src/lib/search/fetchSearchData.ts.
 * Uses postgres.js (getSqlAdmin) instead of Supabase.
 */

import { getSqlAdmin } from '@/server/db/postgres';
import { runTgxSearch } from '@/server/stays/travelgatex/search';
import type { Property } from '@/shared/types';

// ─── Country helpers (minimal subset for destination resolution) ──────────────

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
    'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR',
    'armenia': 'AM', 'australia': 'AU', 'austria': 'AT', 'azerbaijan': 'AZ',
    'bahrain': 'BH', 'bangladesh': 'BD', 'belgium': 'BE', 'belize': 'BZ',
    'bhutan': 'BT', 'bolivia': 'BO', 'bosnia': 'BA', 'botswana': 'BW',
    'brazil': 'BR', 'brunei': 'BN', 'bulgaria': 'BG', 'cambodia': 'KH',
    'canada': 'CA', 'chile': 'CL', 'china': 'CN', 'colombia': 'CO',
    'costa rica': 'CR', 'croatia': 'HR', 'cuba': 'CU', 'cyprus': 'CY',
    'czech republic': 'CZ', 'denmark': 'DK', 'dominican republic': 'DO',
    'ecuador': 'EC', 'egypt': 'EG', 'ethiopia': 'ET', 'finland': 'FI',
    'france': 'FR', 'georgia': 'GE', 'germany': 'DE', 'ghana': 'GH',
    'greece': 'GR', 'guatemala': 'GT', 'hong kong': 'HK', 'hungary': 'HU',
    'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID', 'iran': 'IR',
    'iraq': 'IQ', 'ireland': 'IE', 'israel': 'IL', 'italy': 'IT',
    'jamaica': 'JM', 'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ',
    'kenya': 'KE', 'south korea': 'KR', 'korea': 'KR', 'kuwait': 'KW',
    'kyrgyzstan': 'KG', 'laos': 'LA', 'latvia': 'LV', 'lebanon': 'LB',
    'lithuania': 'LT', 'luxembourg': 'LU', 'macau': 'MO', 'malaysia': 'MY',
    'maldives': 'MV', 'mexico': 'MX', 'moldova': 'MD', 'mongolia': 'MN',
    'morocco': 'MA', 'mozambique': 'MZ', 'myanmar': 'MM', 'nepal': 'NP',
    'netherlands': 'NL', 'new zealand': 'NZ', 'nicaragua': 'NI',
    'nigeria': 'NG', 'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK',
    'panama': 'PA', 'peru': 'PE', 'philippines': 'PH', 'poland': 'PL',
    'portugal': 'PT', 'qatar': 'QA', 'romania': 'RO', 'russia': 'RU',
    'saudi arabia': 'SA', 'senegal': 'SN', 'serbia': 'RS', 'singapore': 'SG',
    'slovakia': 'SK', 'slovenia': 'SI', 'south africa': 'ZA', 'spain': 'ES',
    'sri lanka': 'LK', 'sweden': 'SE', 'switzerland': 'CH', 'syria': 'SY',
    'taiwan': 'TW', 'tajikistan': 'TJ', 'tanzania': 'TZ', 'thailand': 'TH',
    'turkey': 'TR', 'turkmenistan': 'TM', 'ukraine': 'UA',
    'united arab emirates': 'AE', 'uae': 'AE', 'united kingdom': 'GB',
    'uk': 'GB', 'united states': 'US', 'usa': 'US', 'uruguay': 'UY',
    'uzbekistan': 'UZ', 'venezuela': 'VE', 'vietnam': 'VN', 'yemen': 'YE',
    'zambia': 'ZM', 'zimbabwe': 'ZW',
};

const COUNTRY_DEFAULT_CITY: Record<string, string> = {
    TH: 'Bangkok', ID: 'Bali', JP: 'Tokyo', PH: 'Manila', SG: 'Singapore',
    MY: 'Kuala Lumpur', VN: 'Ho Chi Minh', KH: 'Phnom Penh', MM: 'Yangon',
    IN: 'Delhi', CN: 'Beijing', HK: 'Hong Kong', KR: 'Seoul', TW: 'Taipei',
    AU: 'Sydney', NZ: 'Auckland', AE: 'Dubai', SA: 'Riyadh', QA: 'Doha',
    TR: 'Istanbul', EG: 'Cairo', MA: 'Marrakech', KE: 'Nairobi', ZA: 'Cape Town',
    US: 'New York', CA: 'Toronto', MX: 'Mexico City', BR: 'Rio de Janeiro',
    AR: 'Buenos Aires', GB: 'London', FR: 'Paris', DE: 'Berlin', IT: 'Rome',
    ES: 'Barcelona', PT: 'Lisbon', NL: 'Amsterdam', CH: 'Zurich', GR: 'Athens',
    CZ: 'Prague', HU: 'Budapest', PL: 'Warsaw',
};

const CITY_COUNTRY: Record<string, string> = {
    'bangkok': 'TH', 'phuket': 'TH', 'chiang mai': 'TH', 'pattaya': 'TH', 'koh samui': 'TH',
    'bali': 'ID', 'jakarta': 'ID', 'lombok': 'ID', 'yogyakarta': 'ID',
    'tokyo': 'JP', 'osaka': 'JP', 'kyoto': 'JP', 'sapporo': 'JP', 'fukuoka': 'JP',
    'seoul': 'KR', 'busan': 'KR', 'jeju': 'KR', 'incheon': 'KR',
    'singapore': 'SG',
    'kuala lumpur': 'MY', 'penang': 'MY', 'langkawi': 'MY',
    'ho chi minh': 'VN', 'hanoi': 'VN', 'da nang': 'VN', 'hoi an': 'VN',
    'phnom penh': 'KH', 'siem reap': 'KH',
    'manila': 'PH', 'cebu': 'PH', 'boracay': 'PH', 'palawan': 'PH',
    'hong kong': 'HK', 'taipei': 'TW', 'beijing': 'CN', 'shanghai': 'CN',
    'delhi': 'IN', 'mumbai': 'IN', 'goa': 'IN',
    'sydney': 'AU', 'melbourne': 'AU', 'auckland': 'NZ',
    'dubai': 'AE', 'abu dhabi': 'AE', 'doha': 'QA', 'istanbul': 'TR',
    'cairo': 'EG', 'marrakech': 'MA', 'nairobi': 'KE', 'cape town': 'ZA',
    'london': 'GB', 'paris': 'FR', 'berlin': 'DE', 'rome': 'IT', 'milan': 'IT',
    'madrid': 'ES', 'barcelona': 'ES', 'amsterdam': 'NL', 'lisbon': 'PT',
    'zurich': 'CH', 'vienna': 'AT', 'athens': 'GR', 'prague': 'CZ',
    'budapest': 'HU', 'warsaw': 'PL', 'stockholm': 'SE', 'oslo': 'NO',
    'copenhagen': 'DK', 'helsinki': 'FI',
    'new york': 'US', 'los angeles': 'US', 'miami': 'US', 'chicago': 'US',
    'san francisco': 'US', 'toronto': 'CA', 'vancouver': 'CA',
    'mexico city': 'MX', 'cancun': 'MX',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchParams {
    checkIn?: string;
    checkOut?: string;
    checkin?: string;
    checkout?: string;
    destination?: string;
    adults?: string | number;
    children?: string | number;
    childrenAges?: string;
    rooms?: string | number;
    nationality?: string;
    countryCode?: string;
    destinationType?: string;
    currency?: string;
    placeId?: string;
    destinationCode?: string;
    hotelName?: string;
    starRating?: string;
    minRating?: string;
    minReviewsCount?: string;
    facilities?: string;
    strictFacilityFiltering?: string;
    rung?: string;
    lat?: string | number;
    lng?: string | number;
}

export interface SearchQueryParams {
    checkin: string;
    checkout: string;
    adults: number;
    children: number;
    childrenAges?: number[];
    rooms: number;
    guest_nationality: string;
    currency: string;
    cityName: string;
    countryCode: string;
    placeId?: string;
    destinationCode?: string;
    query: string;
    hotelName?: string;
    starRating?: number[];
    minRating?: number;
    minReviewsCount?: number;
    facilities?: number[];
    strictFacilityFiltering?: boolean;
    rung?: string;
    lat?: number;
    lng?: number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatSearchDate(dateInput: string | undefined): string {
    if (!dateInput) return '';
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

function utcDateStr(offsetDays = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

export function parseCheckInDate(params: SearchParams): string {
    return (typeof params.checkIn === 'string' && params.checkIn ? params.checkIn :
        typeof params.checkin === 'string' && params.checkin ? params.checkin : utcDateStr(0));
}

export function parseCheckOutDate(params: SearchParams): string {
    return (typeof params.checkOut === 'string' && params.checkOut ? params.checkOut :
        typeof params.checkout === 'string' && params.checkout ? params.checkout : utcDateStr(1));
}

export function parseFilterParams(params: SearchParams) {
    const hotelName = typeof params.hotelName === 'string' ? params.hotelName : undefined;
    const starRating = typeof params.starRating === 'string'
        ? params.starRating.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 5)
        : undefined;
    const minRating = typeof params.minRating === 'string' ? Number(params.minRating) : undefined;
    const minReviewsCount = typeof params.minReviewsCount === 'string' ? Number(params.minReviewsCount) : undefined;
    const facilities = typeof params.facilities === 'string'
        ? params.facilities.split(',').map(Number).filter(n => !isNaN(n))
        : undefined;
    const strictFacilityFiltering = params.strictFacilityFiltering === 'true';
    return { hotelName, starRating, minRating, minReviewsCount, facilities, strictFacilityFiltering };
}

export function buildSearchQueryParams(params: SearchParams): SearchQueryParams {
    const rawCheckin  = parseCheckInDate(params);
    const rawCheckout = parseCheckOutDate(params);
    const rawDestination = typeof params.destination === 'string' ? params.destination : '';
    const filters = parseFilterParams(params);

    const [destinationCityRaw, ...destinationRest] = rawDestination.split(',');
    const destination = (destinationCityRaw ?? '').trim();
    const destinationCountryHint = destinationRest.join(',').trim();

    const childrenAges = typeof params.childrenAges === 'string' && params.childrenAges
        ? params.childrenAges.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 17)
        : undefined;

    let countryCode = typeof params.countryCode === 'string' && params.countryCode
        ? params.countryCode : '';

    if (!countryCode && destinationCountryHint) {
        countryCode = COUNTRY_NAME_TO_CODE[destinationCountryHint.toLowerCase().trim()] ?? '';
    }
    if (!countryCode && destination) {
        const key = destination.toLowerCase().trim();
        countryCode = CITY_COUNTRY[key]
            || CITY_COUNTRY[key.replace(/\s+(city|island|province|metro|town)$/i, '')]
            || '';
    }

    const isCountryName = !!COUNTRY_NAME_TO_CODE[destination.toLowerCase().trim()];
    const resolvedCountryCode = isCountryName
        ? (COUNTRY_NAME_TO_CODE[destination.toLowerCase().trim()] ?? countryCode)
        : countryCode;
    if (isCountryName && !countryCode) countryCode = resolvedCountryCode;
    const resolvedCityName = isCountryName
        ? (COUNTRY_DEFAULT_CITY[resolvedCountryCode] ?? destination)
        : destination;

    const placeId = typeof params.placeId === 'string' ? params.placeId : undefined;
    const destinationCode = typeof params.destinationCode === 'string' ? params.destinationCode : undefined;
    const currency = typeof params.currency === 'string' && params.currency ? params.currency : 'USD';
    const lat = params.lat !== undefined ? Number(params.lat) : undefined;
    const lng = params.lng !== undefined ? Number(params.lng) : undefined;
    const rung = typeof params.rung === 'string' ? params.rung : undefined;

    const queryParams: SearchQueryParams = {
        checkin: formatSearchDate(rawCheckin) || utcDateStr(0),
        checkout: formatSearchDate(rawCheckout) || utcDateStr(1),
        adults: Number(params.adults) || 2,
        children: Number(params.children) || 0,
        childrenAges,
        rooms: Number(params.rooms) || 1,
        guest_nationality: typeof params.nationality === 'string' && params.nationality ? params.nationality : 'US',
        currency,
        cityName: resolvedCityName,
        countryCode,
        placeId,
        destinationCode,
        query: resolvedCityName,
        rung,
        lat,
        lng,
    };

    if (filters.hotelName) queryParams.hotelName = filters.hotelName;
    if (filters.starRating && filters.starRating.length > 0) queryParams.starRating = filters.starRating;
    if (filters.minRating && filters.minRating > 0) queryParams.minRating = filters.minRating;
    if (filters.minReviewsCount && filters.minReviewsCount > 0) queryParams.minReviewsCount = filters.minReviewsCount;
    if (filters.facilities && filters.facilities.length > 0) {
        queryParams.facilities = filters.facilities;
        if (filters.strictFacilityFiltering) queryParams.strictFacilityFiltering = true;
    }

    return queryParams;
}

// ─── Ratings enrichment ───────────────────────────────────────────────────────

async function fetchHotelRatings(hotelIds: string[]): Promise<Map<string, { rating: number; reviews_count: number }>> {
    const map = new Map<string, { rating: number; reviews_count: number }>();
    if (!hotelIds.length) return map;
    try {
        const sql = getSqlAdmin();
        const rows = await sql<{ hotel_id: string; rating: number; reviews_count: number }[]>`
            SELECT hotel_id, rating, reviews_count
            FROM hotel_reviews
            WHERE hotel_id = ANY(${hotelIds})
        `;
        for (const row of rows) {
            map.set(row.hotel_id, { rating: row.rating ?? 0, reviews_count: row.reviews_count ?? 0 });
        }
    } catch (e) {
        console.error('[fetchHotelRatings] error:', e);
    }
    return map;
}

// ─── Result transformation ────────────────────────────────────────────────────

function extractPrice(hotel: any): { price: number; originalPrice?: number; currency?: string } {
    const result: { price: number; originalPrice?: number; currency?: string } = { price: 0 };
    if (typeof hotel.price === 'number' && hotel.price > 0) {
        result.price = hotel.price;
        result.currency = hotel.currency;
    } else if (hotel.roomTypes?.length > 0) {
        const total = hotel.roomTypes[0]?.rates?.[0]?.retailRate?.total;
        if (Array.isArray(total) && total.length > 0) {
            result.price = (total[0] as any).amount || 0;
            result.currency = (total[0] as any).currency;
        }
    }
    if (hotel.originalPrice) result.originalPrice = hotel.originalPrice;
    return result;
}

function extractRefundableTag(hotel: any): string | undefined {
    if (hotel.refundableTag) return hotel.refundableTag;
    for (const room of hotel.roomTypes ?? []) {
        if (room.refundableTag) return room.refundableTag;
        const tag = room.rates?.[0]?.refundableTag;
        if (tag) return tag;
    }
    return undefined;
}

function transformHotelToProperty(hotel: any, cityName: string, requestedCurrency: string): Property {
    const { price, originalPrice, currency: extractedCurrency } = extractPrice(hotel);
    const currency = extractedCurrency || requestedCurrency;
    const refundableTag = extractRefundableTag(hotel);

    const starRating = hotel.starRating || 0;
    let rating = hotel.reviewRating || hotel.rating || 0;
    if (!rating && starRating > 0) rating = starRating * 1.8;
    const reviewCount = hotel.reviewCount || hotel.reviews || 0;

    const lat = hotel.coordinates?.lat || hotel.latitude || 0;
    const lng = hotel.coordinates?.lng || hotel.longitude || 0;

    return {
        id: hotel.hotelId,
        name: hotel.name || `Hotel ${hotel.hotelId}`,
        location: hotel.location || cityName,
        description: hotel.description || '',
        rating,
        reviews: reviewCount,
        price,
        currency,
        originalPrice,
        image: hotel.image || '',
        images: hotel.images ?? [],
        amenities: hotel.amenities ?? [],
        badges: [],
        type: 'hotel',
        coordinates: { lat, lng },
        refundableTag,
        boardTypes: hotel.boardTypes ?? [],
        city: cityName,
    } as Property;
}

// ─── Main search function ─────────────────────────────────────────────────────

async function fetchSearchPropertiesInner(queryParams: SearchQueryParams): Promise<{ properties: Property[]; totalCount: number; allMappable: any[] }> {
    const tgxData = await runTgxSearch({
        checkin:          queryParams.checkin,
        checkout:         queryParams.checkout,
        adults:           queryParams.adults,
        children:         queryParams.children,
        childrenAges:     queryParams.childrenAges,
        guest_nationality: queryParams.guest_nationality,
        cityName:         queryParams.cityName,
        countryCode:      queryParams.countryCode,
        destinationCode:  queryParams.destinationCode,
        rung:             queryParams.rung as any,
        lat:              queryParams.lat,
        lng:              queryParams.lng,
    }).catch((e: any) => {
        console.error('[Search] TravelgateX failed:', e?.message);
        return null;
    });

    const totalCount: number = (tgxData as any)?.totalCount ?? 0;
    const allMappable: any[] = (tgxData as any)?.allMappable ?? [];

    const results: Property[] = ((tgxData as any)?.data ?? [])
        .map((hotel: any) => transformHotelToProperty(hotel, queryParams.cityName, queryParams.currency))
        .filter((p: Property) => p.name && p.price > 0);

    if (results.length === 0) throw new Error('NO_RESULTS');

    // Enrich with hotel_reviews ratings
    const ids = results.map(p => p.id).filter(Boolean);
    const ratingsMap = await fetchHotelRatings(ids);
    if (ratingsMap.size > 0) {
        for (const prop of results) {
            const etg = ratingsMap.get(prop.id);
            if (etg && etg.rating > 0) {
                prop.rating = etg.rating;
                prop.reviews = etg.reviews_count;
            }
        }
    }

    return {
        properties: results,
        totalCount: totalCount || results.length,
        allMappable: allMappable.length > 0 ? allMappable : results,
    };
}

export async function fetchSearchProperties(params: SearchParams): Promise<{ properties: Property[]; totalCount: number; allMappable: any[] }> {
    const queryParams = buildSearchQueryParams(params);
    try {
        return await fetchSearchPropertiesInner(queryParams);
    } catch (e) {
        if (e instanceof Error && e.message !== 'NO_RESULTS') {
            console.error('Failed to fetch properties:', e);
        }
        return { properties: [], totalCount: 0, allMappable: [] };
    }
}
