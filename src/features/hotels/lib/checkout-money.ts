import { convertForDisplay } from '@/shared/lib/currency';

/**
 * What money goes to checkout with a chosen room.
 *
 * Small enough to inline, kept out here because getting it wrong is a currency bug the
 * customer only sees at the moment they are asked to pay — which is the worst moment for a
 * price to appear to change.
 *
 * Two currencies are in play and they are not the same thing:
 *
 *  - **Supplier Currency** — what OTV quoted. Authoritative for the *price*, and the figure
 *    api-v2 charges from (ADR-0021).
 *  - **Charge Currency** — what Stripe bills the customer, which is the currency they have
 *    been shopping in. The picker offers exactly the three chargeable ones (KRW, USD, PHP),
 *    so the currency on screen can always be charged.
 *
 * Checkout must be handed the second. Handed the first, a room advertised at ₩69,680 a night
 * opened a checkout quoting PHP, with nothing on screen to explain why the money had changed.
 *
 * It follows the page rather than the preference: `convertForDisplay` declines to convert
 * until the live rates are in, so a page still showing the supplier's own figures sends those,
 * and checkout continues to agree with the screen the customer just left.
 *
 * The total is a placeholder, and only that. Checkout replaces it the moment prebook answers,
 * and pays from `display.total` — api-v2's own server-side conversion of its recorded quote —
 * refusing to charge at all if those figures never arrive. So the browser's arithmetic here
 * never reaches a payment.
 */
export function checkoutMoney(
    rate: { price: number; currency?: string | null },
    chargeCurrency: string,
    /**
     * Nights in the stay. A rate arrives priced **per night** — api-v2 divides the supplier's
     * stay total before sending — and checkout summarises a stay, so it is multiplied back up
     * here. Defaults to one so a dateless quote still reads as the single night it was priced
     * as, rather than silently becoming zero.
     */
    nights = 1,
): { currency: string; totalPrice: string } {
    const stay  = rate.price * Math.max(1, nights);
    const shown = convertForDisplay(stay, rate.currency || 'USD', chargeCurrency);

    return {
        currency:   shown.currency,
        // Two decimals is enough for a placeholder; the server's own conversion decides the
        // charge, and rounds for the zero-decimal currencies where Stripe needs whole units.
        totalPrice: String(Math.round(shown.amount * 100) / 100),
    };
}
