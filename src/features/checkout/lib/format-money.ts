/**
 * An amount as the card will see it: the currency code, then the figure to the precision that
 * currency has — cents for USD, none for KRW or JPY.
 *
 * Not `toLocaleString({ maximumFractionDigits: 0 })`, which showed a charge of 272.40 as 272.
 * A price that is quoted to the cent has to be written to the cent.
 */
export function formatMoney(amount: number, currency: string): string {
    return `${currency} ${moneyFigure(amount, currency)}`.trim();
}

/** Decimal places by currency code. Asked of Intl once each: the page formats several amounts on
 *  every render, and building a currency formatter is the slow part of doing it. */
const digitsByCurrency = new Map<string, number>();

function digitsOf(currency: string): number {
    const known = digitsByCurrency.get(currency);
    if (known !== undefined) return known;
    let digits = 2;
    try {
        digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
        // A code Intl does not know: two decimals, the common case, beats a crash mid-render.
    }
    digitsByCurrency.set(currency, digits);
    return digits;
}

/** Just the figure, for a layout that sets the currency code apart from it. */
export function moneyFigure(amount: number, currency: string): string {
    const digits = digitsOf(currency);
    return amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
