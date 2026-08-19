export const FLIGHT_MARKUP  = parseMarkupEnv('FLIGHT_MARKUP_PERCENTAGE', 0.04);
export const HOTEL_MARKUP   = parseMarkupEnv('HOTEL_MARKUP_PERCENTAGE', 0.05);
export const BUNDLE_MARKUP  = parseMarkupEnv('BUNDLE_MARKUP_PERCENTAGE', 0.04);

export const FLIGHT_PRICE_TOLERANCE_LIVE    = 0.50;
export const FLIGHT_PRICE_TOLERANCE_SANDBOX = 10.00;

export const PREBOOK_QUOTE_TTL_MS   = 30 * 60 * 1000; // 30 minutes
export const HOTEL_FX_DISPLAY_TOLERANCE = 0.005; // 0.5%

export const STRIPE_RATE     = 0.029;
export const STRIPE_FLAT_FEE = 0.30;

export function getFlightPriceTolerance(): number {
    const rawOverride = process.env.FLIGHT_PRICE_TOLERANCE?.trim();
    if (rawOverride) {
        const override = Number(rawOverride);
        if (Number.isFinite(override) && override >= 0) return override;
    }
    const token = process.env.DUFFEL_ACCESS_TOKEN ?? process.env.DUFFEL_TOKEN ?? '';
    return token.startsWith('duffel_test_') ? FLIGHT_PRICE_TOLERANCE_SANDBOX : FLIGHT_PRICE_TOLERANCE_LIVE;
}

export function applyMarkup(basePrice: number, markupRate: number) {
    const chargedPrice = round2(basePrice * (1 + markupRate));
    return {
        originalPrice: round2(basePrice),
        chargedPrice,
        markupAmount: round2(chargedPrice - basePrice),
        markupRate,
    };
}

export function toStripeAmount(price: number, currency: string): number {
    return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
        ? Math.round(price)
        : Math.round(price * 100);
}

export function calculateStripeFee(chargedPrice: number): number {
    return round2(chargedPrice * STRIPE_RATE + STRIPE_FLAT_FEE);
}

export function bundleSavingPercent(): number {
    const saving = (1 - (1 + BUNDLE_MARKUP) / (1 + HOTEL_MARKUP)) * 100;
    if (!Number.isFinite(saving) || saving <= 0) return 0;
    return Math.floor(saving * 10) / 10;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
    'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
    'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

function round2(n: number): number { return Math.round(n * 100) / 100; }

function parseMarkupEnv(key: string, defaultValue: number): number {
    const raw = process.env[key];
    if (!raw) return defaultValue;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(0, Math.min(0.50, parsed));
}
