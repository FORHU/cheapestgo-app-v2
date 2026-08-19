import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { getSqlAdmin } from '@/server/db/postgres';
import { safeError } from '@/server/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    try {
        const sql = getSqlAdmin();
        const rows = await sql`
            SELECT
                booking_id, property_name, property_image, room_name,
                check_in, check_out, guests_adults, guests_children,
                total_price, currency, holder_first_name, holder_last_name,
                holder_email, status, policy_type, cancellation_policy,
                provider, payment_intent_id, special_requests,
                property_lat, property_lng, created_at
            FROM bookings
            WHERE user_id = ${user.id}
            ORDER BY created_at DESC
        `;
        return Response.json({ success: true, data: rows });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/list') }, { status: 500 });
    }
}
