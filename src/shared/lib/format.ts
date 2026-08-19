/**
 * Formatting utilities
 */

export function formatDuration(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatDate(date: Date | string | null, options?: Intl.DateTimeFormatOptions): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', options ?? { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatNumber(n: number): string {
    return new Intl.NumberFormat('en-US').format(n);
}

/**
 * `$`, `₱`, `€` … — whatever `Intl` prefixes an amount with, on its own.
 *
 * For the places that draw the symbol and the digits as separate type: the
 * property page's price sets the symbol a size below the number, and the
 * filter panel's readout puts one symbol in front of a range. Unknown codes
 * come back empty, so callers fall back to the code itself.
 */
export function currencySymbol(currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
            .format(0)
            .replace(/[\d\s., ]/g, '');
    } catch {
        return '';
    }
}
