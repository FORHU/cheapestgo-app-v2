/**
 * Pure helpers for the checkout page.
 *
 * The page itself (`src/app/[locale]/checkout/page.tsx`) is a single client
 * component that also loads Stripe and the router; this is the part worth
 * pinning down with a test, so it lives out here where a test can reach it
 * without dragging the whole page in.
 */

// ─── Stay dates, as the summary card prints them ──────────────────────────────

/**
 * `September 4 - 6 2026 (2 nights)` when the stay is within one month,
 * `August 30 - September 2 2026 (3 nights)` when it crosses one.
 *
 * Both dates are read as plain calendar days (`T00:00:00`, no zone) so the
 * label never slips a day against the picker the guest used.
 */
export function formatStayDates(checkIn: string, checkOut: string): string {
    if (!checkIn || !checkOut) return '';

    const ci = new Date(`${checkIn}T00:00:00`);
    const co = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) return '';

    const nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86_400_000));
    const monthCi = ci.toLocaleDateString('en-US', { month: 'long' });
    const monthCo = co.toLocaleDateString('en-US', { month: 'long' });

    const left = `${monthCi} ${ci.getDate()}`;
    const right = monthCi === monthCo
        ? `${co.getDate()} ${co.getFullYear()}`
        : `${monthCo} ${co.getDate()} ${co.getFullYear()}`;

    return `${left} - ${right} (${nights} night${nights === 1 ? '' : 's'})`;
}
