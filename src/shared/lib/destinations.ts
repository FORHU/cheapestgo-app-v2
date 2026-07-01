export interface PopularDestination {
    id: string;
    city: string;
    country: string;
    imagePath: string;
}

export const POPULAR_DESTINATIONS: PopularDestination[] = [
    // ── Philippines ────────────────────────────────────────────────────────────
    { id: 'boracay',      city: 'Boracay',         country: 'Philippines', imagePath: '/images/destinations/boracay.webp' },
    { id: 'palawan',      city: 'Palawan',          country: 'Philippines', imagePath: '/images/destinations/palawan.webp' },
    { id: 'siargao',      city: 'Siargao',          country: 'Philippines', imagePath: '/images/destinations/siargao.webp' },
    { id: 'cebu',         city: 'Cebu',             country: 'Philippines', imagePath: '/images/destinations/cebu.webp' },
    { id: 'manila',       city: 'Manila',           country: 'Philippines', imagePath: '/images/destinations/manila.webp' },
    // ── Southeast Asia ─────────────────────────────────────────────────────────
    { id: 'bali',         city: 'Bali',             country: 'Indonesia',   imagePath: '/images/destinations/bali.webp' },
    { id: 'bangkok',      city: 'Bangkok',          country: 'Thailand',    imagePath: '/images/destinations/bangkok.webp' },
    { id: 'phuket',       city: 'Phuket',           country: 'Thailand',    imagePath: '/images/destinations/phuket.webp' },
    { id: 'singapore',    city: 'Singapore',        country: 'Singapore',   imagePath: '/images/destinations/singapore.webp' },
    { id: 'kuala-lumpur', city: 'Kuala Lumpur',     country: 'Malaysia',    imagePath: '/images/destinations/kuala-lumpur.webp' },
    { id: 'ho-chi-minh',  city: 'Ho Chi Minh City', country: 'Vietnam',     imagePath: '/images/destinations/ho-chi-minh.webp' },
    { id: 'da-nang',      city: 'Da Nang',          country: 'Vietnam',     imagePath: '/images/destinations/da-nang.webp' },
    // ── East Asia ──────────────────────────────────────────────────────────────
    { id: 'tokyo',        city: 'Tokyo',            country: 'Japan',       imagePath: '/images/destinations/tokyo.webp' },
    { id: 'osaka',        city: 'Osaka',            country: 'Japan',       imagePath: '/images/destinations/osaka.webp' },
    { id: 'seoul',        city: 'Seoul',            country: 'South Korea', imagePath: '/images/destinations/seoul.webp' },
    { id: 'hong-kong',    city: 'Hong Kong',        country: 'Hong Kong',   imagePath: '/images/destinations/hong-kong.webp' },
    { id: 'taipei',       city: 'Taipei',           country: 'Taiwan',      imagePath: '/images/destinations/taipei.webp' },
    // ── South Asia & Oceania ───────────────────────────────────────────────────
    { id: 'maldives',     city: 'Maldives',         country: 'Maldives',    imagePath: '/images/destinations/maldives.webp' },
    { id: 'sydney',       city: 'Sydney',           country: 'Australia',   imagePath: '/images/destinations/sydney.webp' },
    { id: 'melbourne',    city: 'Melbourne',        country: 'Australia',   imagePath: '/images/destinations/melbourne.webp' },
];
