/**
 * Server-side currency helpers with strict error semantics for charge paths.
 * Client-safe display conversion lives in src/shared/lib/currency.ts.
 * Ported from v1's src/lib/currency.ts (server section).
 */

const STATIC_RATES: Record<string, number> = {
    USD: 1.0, PHP: 0.01626866, KRW: 0.00070678, JPY: 0.00628039,
    EUR: 1.15640492, GBP: 1.35322941, AUD: 0.7077762, SGD: 0.78186511,
    MYR: 0.24472328, THB: 0.03018687, VND: 0.00003835, IDR: 0.00005611,
    CNY: 0.1479156, TWD: 0.03126238, HKD: 0.12742761, INR: 0.01047082,
    AED: 0.27229408, CAD: 0.72072799,
};

export const EXCHANGE_RATES: Record<string, number> = { ...STATIC_RATES };

const REFRESH_INTERVAL = 60 * 60 * 1000;
let _lastRefresh = 0;
let _inFlight: Promise<boolean> | null = null;

export function ratesAreStatic(): boolean { return _lastRefresh === 0; }
export function ratesAgeMs(): number { return _lastRefresh === 0 ? Infinity : Date.now() - _lastRefresh; }

function applyRates(rates: Record<string, number>): void {
    for (const [currency, rate] of Object.entries(rates)) {
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) EXCHANGE_RATES[currency] = rate;
    }
    _lastRefresh = Date.now();
}

export async function refreshExchangeRates(force = false): Promise<boolean> {
    if (!force && _lastRefresh && Date.now() - _lastRefresh < REFRESH_INTERVAL) return false;
    if (_inFlight) return _inFlight;
    _inFlight = (async () => {
        try {
            const { getLiveRates } = await import('@/server/exchange-rates');
            const result = await getLiveRates(force);
            if (!result) return false;
            applyRates(result.rates);
            return true;
        } catch {
            return false;
        } finally {
            _inFlight = null;
        }
    })();
    return _inFlight;
}

export class ExchangeRateError extends Error {
    constructor(message: string) { super(message); this.name = 'ExchangeRateError'; }
}

export function convertCurrencyStrict(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    maxAgeMs = 24 * 60 * 60 * 1000,
): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return amount;
    if (!Number.isFinite(amount)) throw new ExchangeRateError(`Refusing to convert non-finite amount: ${amount}`);
    const fromRate = EXCHANGE_RATES[from];
    const toRate = EXCHANGE_RATES[to];
    if (!fromRate || !toRate) throw new ExchangeRateError(`No exchange rate for ${!fromRate ? from : to} — cannot convert ${from}→${to} safely.`);
    const age = ratesAgeMs();
    if (age > maxAgeMs) throw new ExchangeRateError(`Exchange rates are ${age === Infinity ? 'unfetched' : `${Math.round(age / 3600_000)}h old`}; refusing to convert ${from}→${to} for a charge.`);
    return (amount * fromRate) / toRate;
}
