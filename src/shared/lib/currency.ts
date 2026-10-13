/**
 * Currency conversion utilities.
 * Static fallback rates; call refreshExchangeRates() on app mount to hydrate.
 */

import { http } from './http';

const STATIC_RATES: Record<string, number> = {
    USD: 1.0,
    PHP: 0.018,
    KRW: 0.00075,
    JPY: 0.0067,
    EUR: 1.087,
    GBP: 1.266,
    AUD: 0.658,
    SGD: 0.74,
    MYR: 0.21,
    THB: 0.027,
    VND: 0.0000392,
    IDR: 0.0000621,
    CNY: 0.138,
    TWD: 0.0307,
    HKD: 0.127,
    INR: 0.012,
    AED: 0.272,
    CAD: 0.73,
};

export const EXCHANGE_RATES: Record<string, number> = { ...STATIC_RATES };

let _lastRefresh = 0;

/**
 * Whether the rates above came from the server or are still the built-in fallback.
 *
 * The fallback is far enough out to matter — PHP sits at 0.018 here against a live 0.0159, 13%
 * — so a price converted with it is not approximately right, it is wrong. Nothing may convert
 * until this is true; see `convertForDisplay`.
 */
export function ratesAreLive(): boolean {
    return _lastRefresh > 0;
}

/**
 * Told when the rates land.
 *
 * `EXCHANGE_RATES` is mutated in place, which React cannot see: a page that rendered before the
 * fetch returned would otherwise keep its fallback prices until something else happened to
 * re-render it. Components subscribe through `useLiveRates`.
 */
const listeners = new Set<() => void>();

export function subscribeToRates(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function refreshExchangeRates(): Promise<boolean> {
    if (_lastRefresh && Date.now() - _lastRefresh < 60 * 60 * 1000) return false;
    try {
        const res = await http.get<{ success: boolean; rates: Record<string, number> }>('/exchange-rates');
        if (!res.success || !res.rates) return false;
        for (const [currency, rate] of Object.entries(res.rates)) {
            EXCHANGE_RATES[currency] = rate;
        }
        _lastRefresh = Date.now();
        listeners.forEach(notify => notify());
        return true;
    } catch {
        return false;
    }
}

/**
 * A price and the currency to print beside it.
 *
 * Returns the amount **in its original currency** when the rates are not live yet, rather than
 * a converted-looking number that is 13% out. Showing "₱3,198" for a moment and then "₩69,680"
 * is honest; showing "₩76,752" and charging ₩69,680 is not — and the second is what a silent
 * fallback conversion produces.
 *
 * Callers must print the currency this returns, not the one they asked for. That is the whole
 * point of handing back both.
 */
export function convertForDisplay(
    amount: number,
    from: string,
    to: string,
): { amount: number; currency: string } {
    const f = (from || 'USD').toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return { amount, currency: t };
    if (!ratesAreLive()) return { amount, currency: f };

    const fromRate = EXCHANGE_RATES[f];
    const toRate   = EXCHANGE_RATES[t];
    if (!fromRate || !toRate) return { amount, currency: f };

    return { amount: (amount * fromRate) / toRate, currency: t };
}

export function convertCurrency(amount: number, from: string, to: string): number {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return amount;
    const fromRate = EXCHANGE_RATES[f];
    const toRate = EXCHANGE_RATES[t];
    if (!fromRate || !toRate) return amount;
    return (amount * fromRate) / toRate;
}

export function getCurrencySymbol(currency: string): string {
    const map: Record<string, string> = {
        USD: '$',
        PHP: '₱',
        KRW: '₩',
        JPY: '¥',
        CNY: '¥',
        EUR: '€',
        GBP: '£',
        AUD: 'A$',
        SGD: 'S$',
        CAD: 'C$',
        HKD: 'HK$',
    };
    return map[currency.toUpperCase()] ?? currency;
}

export const CURRENCIES = [
    { code: 'USD', label: 'US Dollar' },
    { code: 'EUR', label: 'Euro' },
    { code: 'GBP', label: 'British Pound' },
    { code: 'KRW', label: 'Korean Won' },
    { code: 'JPY', label: 'Japanese Yen' },
    { code: 'PHP', label: 'Philippine Peso' },
    { code: 'SGD', label: 'Singapore Dollar' },
    { code: 'AUD', label: 'Australian Dollar' },
    { code: 'CAD', label: 'Canadian Dollar' },
    { code: 'THB', label: 'Thai Baht' },
    { code: 'MYR', label: 'Malaysian Ringgit' },
    { code: 'IDR', label: 'Indonesian Rupiah' },
    { code: 'VND', label: 'Vietnamese Dong' },
    { code: 'CNY', label: 'Chinese Yuan' },
    { code: 'INR', label: 'Indian Rupee' },
    { code: 'AED', label: 'UAE Dirham' },
];
