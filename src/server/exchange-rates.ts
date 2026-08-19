/**
 * Live exchange rate fetching (server-only).
 * Ported from v1's src/lib/server/exchange-rates.ts.
 */

export const SUPPORTED_CURRENCIES = [
    'USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'AUD', 'SGD',
    'MYR', 'THB', 'VND', 'IDR', 'CNY', 'TWD', 'HKD', 'INR', 'AED', 'CAD',
] as const;

export type RateSource = 'live' | 'live-partial' | 'cache' | 'stale-cache';

export interface RatesResult {
    rates: Record<string, number>;
    source: RateSource;
    provider: string;
    fetchedAt: number;
    missing: string[];
}

const CACHE_TTL = 60 * 60 * 1000;
const UPSTREAM_TIMEOUT = 5000;

let cached: RatesResult | null = null;

function toUsdPerUnit(apiRates: Record<string, unknown>): Record<string, number> {
    const out: Record<string, number> = { USD: 1.0 };
    for (const code of SUPPORTED_CURRENCIES) {
        if (code === 'USD') continue;
        const raw = apiRates[code];
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) out[code] = 1 / raw;
    }
    return out;
}

function missingFrom(rates: Record<string, number>): string[] {
    return SUPPORTED_CURRENCIES.filter(c => !(c in rates));
}

async function fetchFromErApi(): Promise<Record<string, number> | null> {
    const key = process.env.EXCHANGE_RATES_API_KEY;
    const url = key
        ? `https://v6.exchangerate-api.com/v6/${key}/latest/USD`
        : 'https://open.er-api.com/v6/latest/USD';
    const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT), cache: 'no-store' });
    if (!res.ok) throw new Error(`er-api returned ${res.status}`);
    const data = await res.json();
    const apiRates = data.conversion_rates ?? data.rates;
    if (!apiRates || typeof apiRates !== 'object') throw new Error('er-api returned no rates');
    return toUsdPerUnit(apiRates);
}

async function fetchFromFrankfurter(): Promise<Record<string, number> | null> {
    const symbols = SUPPORTED_CURRENCIES.filter(c => c !== 'USD').join(',');
    const res = await fetch(
        `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`,
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT), cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`frankfurter returned ${res.status}`);
    const data = await res.json();
    if (!data?.rates) throw new Error('frankfurter returned no rates');
    return toUsdPerUnit(data.rates);
}

export async function getLiveRates(force = false): Promise<RatesResult | null> {
    const now = Date.now();
    if (!force && cached && now - cached.fetchedAt < CACHE_TTL) return { ...cached, source: 'cache' };

    const providers: Array<[string, () => Promise<Record<string, number> | null>]> = [
        ['er-api', fetchFromErApi],
        ['frankfurter', fetchFromFrankfurter],
    ];

    for (const [name, fn] of providers) {
        try {
            const rates = await fn();
            if (!rates) continue;
            const missing = missingFrom(rates);
            if (missing.length > SUPPORTED_CURRENCIES.length / 2) throw new Error(`only ${Object.keys(rates).length} usable rates`);
            cached = { rates, source: missing.length ? 'live-partial' : 'live', provider: name, fetchedAt: now, missing };
            if (missing.length) console.warn(`[exchange-rates] ${name} missing: ${missing.join(', ')}`);
            return cached;
        } catch (err) {
            console.error(`[exchange-rates] provider ${name} failed:`, err);
        }
    }

    if (cached) { console.warn('[exchange-rates] all providers failed — serving stale cache'); return { ...cached, source: 'stale-cache' }; }
    console.error('[exchange-rates] all providers failed and no cache available');
    return null;
}

export function __resetRatesCache() { cached = null; }
