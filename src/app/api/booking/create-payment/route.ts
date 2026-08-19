import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/server/auth/session';
import { stripe } from '@/server/stripe';
import { rateLimit } from '@/server/rate-limit';
import { checkCsrf } from '@/server/csrf';
import { applyMarkup, toStripeAmount, HOTEL_MARKUP, BUNDLE_MARKUP } from '@/lib/pricing';
import { convertCurrencyStrict, refreshExchangeRates } from '@/server/currency';
import { resolveHotelChargeBase } from '@/server/bookings/hotelChargeBase';
import { getSqlAdmin } from '@/server/db/postgres';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const SUPPORTED_CURRENCIES = new Set([
    'usd', 'eur', 'gbp', 'aud', 'cad', 'sgd', 'hkd', 'jpy', 'krw',
    'thb', 'php', 'myr', 'idr', 'inr', 'aed', 'nzd', 'chf', 'sek',
    'nok', 'dkk', 'brl', 'mxn', 'zar', 'try', 'pln', 'czk', 'huf',
]);

const MAX_AMOUNT_BY_CURRENCY: Record<string, number> = {
    usd: 100_000,     eur: 95_000,      gbp: 80_000,
    aud: 160_000,     cad: 140_000,     sgd: 140_000,
    hkd: 800_000,     chf: 92_000,      nzd: 170_000,
    aed: 370_000,     inr: 8_500_000,   thb: 3_600_000,
    php: 5_800_000,   myr: 480_000,     brl: 510_000,
    mxn: 1_700_000,   zar: 1_900_000,   try: 3_200_000,
    pln: 410_000,     czk: 2_300_000,   huf: 37_000_000,
    sek: 1_100_000,   nok: 1_100_000,   dkk: 700_000,
    jpy: 15_000_000,  krw: 140_000_000, idr: 1_600_000_000,
    vnd: 2_500_000_000,
};

export async function POST(req: NextRequest) {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const rl = await rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'hotel-payment' });
    if (!rl.success) {
        return NextResponse.json({ success: false, error: 'Too many requests. Please wait before trying again.' }, { status: 429 });
    }

    try {
        const { user } = await getSession();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }

        const body = await req.json();
        const { prebookId, amount, currency, holderEmail, propertyName, roomName, bundleFlightId, checkIn, checkOut } = body as {
            prebookId: string;
            amount: number;
            currency: string;
            holderEmail: string;
            propertyName?: string;
            roomName?: string;
            checkIn?: string;
            checkOut?: string;
            bundleFlightId?: string;
        };

        const maxAmount = MAX_AMOUNT_BY_CURRENCY[currency?.toLowerCase()] ?? 100_000;

        if (!prebookId) return NextResponse.json({ success: false, error: 'prebookId is required' }, { status: 400 });
        if (!amount || typeof amount !== 'number' || amount <= 0 || amount > maxAmount) {
            return NextResponse.json({ success: false, error: `Valid amount is required (must be between 0 and ${maxAmount.toLocaleString()} ${currency?.toUpperCase() ?? ''})` }, { status: 400 });
        }
        if (!currency) return NextResponse.json({ success: false, error: 'Currency is required' }, { status: 400 });
        if (!SUPPORTED_CURRENCIES.has(currency.toLowerCase())) return NextResponse.json({ success: false, error: `Unsupported currency: ${currency}` }, { status: 400 });

        // Duplicate booking guard
        if (propertyName && checkIn && checkOut) {
            const sql = getSqlAdmin();
            const existing = await sql`
                SELECT booking_id, check_in, check_out FROM bookings
                WHERE user_id = ${user.id}
                  AND property_name = ${propertyName}
                  AND status = ANY(ARRAY['confirmed','pending','completed'])
                  AND check_in < ${checkOut}::date
                  AND check_out > ${checkIn}::date
                LIMIT 1
            `;
            if (existing.length > 0) {
                const b = existing[0];
                return NextResponse.json({
                    success: false,
                    code: 'DUPLICATE_BOOKING',
                    existingBookingId: b.booking_id,
                    existingCheckIn: b.check_in,
                    existingCheckOut: b.check_out,
                    error: `You already have an active booking at ${propertyName} for overlapping dates.`,
                }, { status: 409 });
            }
        }

        // Load the supplier quote
        const sql = getSqlAdmin();
        const quoteRows = await sql`
            SELECT gross, currency, expires_at FROM hotel_prebook_quotes
            WHERE prebook_id = ${prebookId} LIMIT 1
        `;
        const quote = quoteRows[0] ?? null;

        if (quote && String(quote.currency).toUpperCase() !== currency.toUpperCase()) {
            await refreshExchangeRates();
        }

        const resolved = resolveHotelChargeBase(quote, amount, currency, convertCurrencyStrict);

        if (!resolved.ok) {
            console.warn(`[create-payment] Rejected (${resolved.code}) prebookId=${prebookId.slice(0, 40)} client=${amount} ${currency.toUpperCase()}`);
            return NextResponse.json({
                success: false,
                error: resolved.message,
                code: resolved.code,
                ...(resolved.serverPrice !== undefined ? { serverPrice: resolved.serverPrice, currency: resolved.currency } : {}),
            }, { status: resolved.code === 'FX_UNAVAILABLE' ? 503 : 409 });
        }

        const baseInChargeCurrency = resolved.base;
        const markupRate = bundleFlightId ? BUNDLE_MARKUP : HOTEL_MARKUP;
        const pricing = applyMarkup(baseInChargeCurrency, markupRate);
        const stripeAmount = toStripeAmount(pricing.chargedPrice, currency);

        console.log(`[create-payment] quote=${resolved.quoteGross} ${resolved.quoteCurrency} → base=${pricing.originalPrice} ${currency}, charged=${pricing.chargedPrice}, markup=${(markupRate * 100).toFixed(0)}%`);

        const prebookHash = createHash('sha256')
            .update(`${prebookId}:${stripeAmount}:${currency.toLowerCase()}`)
            .digest('hex')
            .slice(0, 40);
        const idempotencyKey = `hotel-pi-${user.id}-${prebookHash}`;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: currency.toLowerCase(),
            capture_method: 'automatic',
            metadata: {
                prebookId: prebookId.slice(0, 490),
                userId: user.id,
                holderEmail: holderEmail || '',
                type: bundleFlightId ? 'hotel_bundle' : 'hotel',
                bundleFlightId: bundleFlightId || '',
                originalPrice: String(pricing.originalPrice),
                markupRate: String(markupRate),
                markupAmount: String(pricing.markupAmount),
            },
            description: `CG: ${propertyName || 'Hotel'} — ${roomName || 'Room'}`,
        }, { idempotencyKey });

        return NextResponse.json({ success: true, data: { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id } });
    } catch (err: any) {
        console.error('[create-payment] Error:', err);
        const message = process.env.NODE_ENV === 'production' ? 'Failed to create payment. Please try again.' : (err.message || 'Failed to create payment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
