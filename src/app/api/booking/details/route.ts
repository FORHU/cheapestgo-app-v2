import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { getSqlAdmin } from '@/server/db/postgres';
import { safeError } from '@/server/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    try {
        const { bookingId } = await req.json() as { bookingId?: string };
        if (!bookingId) {
            return Response.json({ success: false, error: 'bookingId is required' }, { status: 400 });
        }

        const sql = getSqlAdmin();
        const rows = await sql`
            SELECT
                booking_id, property_name, property_image, room_name,
                check_in, check_out, guests_adults, guests_children,
                total_price, currency, holder_first_name, holder_last_name,
                holder_email, status, policy_type, cancellation_policy,
                provider, provider_metadata, payment_intent_id,
                special_requests, voucher_code, discount_amount,
                property_lat, property_lng, created_at,
                supplier_cost, charged_price
            FROM bookings
            WHERE booking_id = ${bookingId}
              AND user_id    = ${user.id}
            LIMIT 1
        `;

        if (!rows.length) {
            return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
        }

        return Response.json({ success: true, data: rows[0] });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/details') }, { status: 500 });
    }
}
