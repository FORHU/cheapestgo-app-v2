/**
 * Currency conversion utilities.
 * Static fallback rates; call refreshExchangeRates() on app mount to hydrate.
 */

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

export async function refreshExchangeRates(): Promise<boolean> {
    if (_lastRefresh && Date.now() - _lastRefresh < 60 * 60 * 1000) return false;
    try {
        const res = await fetch('/api/v2/exchange-rates');
        if (!res.ok) return false;
        const json = await res.json();
        if (!json.success || !json.rates) return false;
        for (const [currency, rate] of Object.entries(json.rates as Record<string, number>)) {
            EXCHANGE_RATES[currency] = rate;
        }
        _lastRefresh = Date.now();
        return true;
    } catch {
        return false;
    }
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
