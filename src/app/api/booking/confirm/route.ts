import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { confirmAndSaveTgxBooking } from '@/server/bookings/confirmTgx';
import { stripe } from '@/server/stripe';
import { createNotification } from '@/server/admin/notify';
import { sendBookingConfirmationEmail } from '@/server/email';
import { rateLimit } from '@/server/rate-limit';
import { safeError } from '@/server/safe-error';
import { checkCsrf } from '@/server/csrf';
import { bookingConfirmSchema } from '@/lib/schemas/booking';
import { getSqlAdmin } from '@/server/db/postgres';
import { revalidatePath } from 'next/cache';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const rl = await rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'hotel-confirm', userId: user.id });
    if (!rl.success) {
        return Response.json({ success: false, error: 'Too many requests. Please wait before trying again.' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = bookingConfirmSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
        }

        if (body.paymentIntentId) {
            const pi = await stripe.paymentIntents.retrieve(body.paymentIntentId);
            if (pi.status !== 'succeeded') {
                return Response.json({ success: false, error: `Payment not completed (status: ${pi.status})` }, { status: 400 });
            }
            if (pi.metadata?.userId !== user.id) {
                return Response.json({ success: false, error: 'Payment does not belong to this user' }, { status: 403 });
            }

            // Idempotency check
            const sql = getSqlAdmin();
            const existing = await sql`
                SELECT booking_id, status, total_price, currency
                FROM bookings WHERE payment_intent_id = ${body.paymentIntentId} LIMIT 1
            `;
            if (existing.length > 0) {
                const b = existing[0];
                console.log(`[confirm] Idempotent return for PI ${body.paymentIntentId}: ${b.booking_id}`);
                return Response.json({ success: true, data: { bookingId: b.booking_id, status: b.status, policyType: 'standard', policySummary: '', totalPrice: b.total_price, currency: b.currency } });
            }
        }

        const quoteToken = String(body.prebookId).startsWith('TGX:') ? String(body.prebookId).slice(4) : String(body.prebookId);

        const result = await confirmAndSaveTgxBooking({
            quoteToken,
            holder: body.holder,
            guests: body.guests || [],
            propertyName: body.propertyName || '',
            propertyImage: body.propertyImage,
            roomName: body.roomName || body.holder?.firstName || 'Standard Room',
            checkIn: body.checkIn || '',
            checkOut: body.checkOut || '',
            adults: body.adults || 2,
            children: body.children || 0,
            currency: body.currency || 'USD',
            specialRequests: body.specialRequests,
            paymentIntentId: body.paymentIntentId,
            voucherCode: body.voucherCode,
            discountAmount: body.discountAmount,
            cancellationPolicies: body.cancellationPolicies,
            quotedPrice: body.quotedPrice,
        }, user);

        if (result.success) {
            revalidatePath('/trips');
            createNotification('Hotel Booking Confirmed', `Booking ${result.data?.bookingId || ''} confirmed for ${user.email}.`, 'booking');
            sendBookingConfirmationEmail({
                bookingId: result.data?.bookingId || '',
                email: body.holder?.email || user.email || '',
                guestName: `${body.holder?.firstName || ''} ${body.holder?.lastName || ''}`.trim(),
                hotelName: body.propertyName || '',
                roomName: body.roomName || '',
                checkIn: body.checkIn || '',
                checkOut: body.checkOut || '',
                totalPrice: result.data?.totalPrice || 0,
                currency: result.data?.currency || body.currency || 'USD',
            }).catch(e => console.error('[confirm] Email failed:', e));
            return Response.json(result);
        }

        if (!result.success && result.errorCode === 'price_changed' && body.paymentIntentId) {
            try {
                const refund = await stripe.refunds.create({ payment_intent: body.paymentIntentId });
                console.log(`[confirm] Price-change refund ${refund.id} issued`);
            } catch (refundErr: any) {
                console.error('[confirm] Price-change refund failed:', refundErr.message);
            }
            return Response.json({
                success: false,
                errorCode: 'price_changed',
                oldPrice: result.oldPrice,
                newPrice: result.newPrice,
                error: 'The price for this room increased after you were quoted. Your payment has been automatically refunded.',
            });
        }

        if (!result.providerConfirmed && body.paymentIntentId) {
            const isBalanceErr = /insufficient_b2b_balance|b2b_balance|insufficient.*balance/i.test(result.error || '');
            if (isBalanceErr) {
                createNotification('CRITICAL: TravelgateX B2B balance exhausted', `Hotel booking failed for ${user.email}. PI: ${body.paymentIntentId}.`, 'alert');
            }
            const baseError = isBalanceErr ? 'Hotel booking is temporarily unavailable' : (result.error || 'Booking failed');
            const failureCode = isBalanceErr ? 'balance_insufficient' : 'booking_failed_refunded';
            try {
                const refund = await stripe.refunds.create({ payment_intent: body.paymentIntentId });
                console.log(`[confirm] Auto-refunded ${refund.id} for failed booking`);
                return Response.json({ success: false, errorCode: failureCode, error: baseError + '. Your payment has been automatically refunded.' });
            } catch (refundErr: any) {
                console.error('[confirm] Refund failed:', refundErr.message);
                return Response.json({ success: false, errorCode: failureCode, error: baseError + '. Please contact support for a refund.' });
            }
        }

        if (result.providerConfirmed) {
            createNotification('CRITICAL: DB Save Failed After Booking Confirm', `Booking ${result.data?.bookingId || 'unknown'} confirmed for ${user.email} but DB save failed. PI: ${body.paymentIntentId || 'N/A'}`, 'alert');
            return Response.json({ success: false, error: result.error, data: result.data }, { status: 500 });
        }

        return Response.json(result);
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/confirm') }, { status: 500 });
    }
}
