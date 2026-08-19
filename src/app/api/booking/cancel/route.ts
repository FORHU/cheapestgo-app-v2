import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { getSqlAdmin } from '@/server/db/postgres';
import { cancelTravelgateX } from '@/server/travelgatex';
import { stripe } from '@/server/stripe';
import { createNotification } from '@/server/admin/notify';
import { sendHotelCancellationEmail } from '@/server/email';
import { safeError } from '@/server/safe-error';
import { checkCsrf } from '@/server/csrf';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const cancelSchema = z.object({ bookingId: z.string().min(1) });

export async function POST(req: NextRequest) {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = cancelSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
        }
        const { bookingId } = parsed.data;

        const sql = getSqlAdmin();

        // Fetch booking and verify ownership
        const rows = await sql`
            SELECT
                booking_id, user_id, status, payment_intent_id,
                policy_type, cancellation_policy, total_price, currency,
                provider_metadata, property_name, room_name,
                check_in, check_out, holder_email,
                holder_first_name, holder_last_name
            FROM bookings
            WHERE booking_id = ${bookingId} AND user_id = ${user.id}
            LIMIT 1
        `;

        if (!rows.length) {
            return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
        }

        const booking = rows[0] as Record<string, any>;

        if (booking.status === 'cancelled') {
            return Response.json({ success: false, error: 'Booking is already cancelled' }, { status: 400 });
        }

        // Cancel with TravelgateX
        const meta = booking.provider_metadata as Record<string, any> | null;
        let tgxCancelled = false;
        try {
            await cancelTravelgateX({
                clientReference: bookingId,
                supplierReference: meta?.supplierRef ?? undefined,
                tgxBookingId:     meta?.hotelRef    ?? undefined,
                hotelCode:        meta?.hotelCode   ?? undefined,
            });
            tgxCancelled = true;
        } catch (tgxErr: any) {
            console.error('[cancel] TGX cancel error:', tgxErr.message);
            // Continue anyway — update DB to cancelled and attempt refund
        }

        // Determine refund eligibility from stored cancel policy
        const policy = booking.cancellation_policy as Record<string, any> | null;
        const isRefundable = booking.policy_type === 'free_cancellation' ||
            policy?.refundableTag === 'RFN' ||
            policy?.refundableTag === 'REFUNDABLE';

        let refundAmount: number | undefined;
        let refundCurrency: string | undefined;
        let refundStatus = 'non_refundable';

        if (isRefundable && booking.payment_intent_id) {
            try {
                const refund = await stripe.refunds.create({ payment_intent: booking.payment_intent_id });
                refundAmount   = refund.amount / 100;
                refundCurrency = (refund.currency || 'usd').toUpperCase();
                refundStatus   = refund.status === 'succeeded' ? 'succeeded' : 'pending';
                console.log(`[cancel] Stripe refund ${refund.id} issued: ${refundAmount} ${refundCurrency}`);
            } catch (refundErr: any) {
                console.error('[cancel] Stripe refund failed:', refundErr.message);
                refundStatus = 'failed';
            }
        }

        // Mark cancelled in DB
        await sql`
            UPDATE bookings
            SET status = 'cancelled', cancellation_date = NOW()
            WHERE booking_id = ${bookingId}
        `;

        revalidatePath('/trips');
        createNotification('Booking Cancelled', `Booking ${bookingId} cancelled by ${user.email}.`, 'booking');

        sendHotelCancellationEmail({
            bookingId,
            email:      booking.holder_email || user.email || '',
            guestName:  `${booking.holder_first_name || ''} ${booking.holder_last_name || ''}`.trim(),
            hotelName:  booking.property_name  || '',
            roomName:   booking.room_name      || '',
            checkIn:    booking.check_in       || '',
            checkOut:   booking.check_out      || '',
            refundAmount,
            currency:      refundCurrency,
            refundStatus,
        }).catch(e => console.error('[cancel] Email error:', e));

        return Response.json({
            success: true,
            data: {
                bookingId,
                status: 'cancelled',
                tgxCancelled,
                refund: refundAmount != null
                    ? { amount: refundAmount, currency: refundCurrency, status: refundStatus }
                    : null,
            },
        });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/cancel') }, { status: 500 });
    }
}
