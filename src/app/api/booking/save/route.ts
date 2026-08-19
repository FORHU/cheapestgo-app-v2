import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { getSqlAdmin } from '@/server/db/postgres';
import { safeError } from '@/server/safe-error';
import { checkCsrf } from '@/server/csrf';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * Upserts a booking row — used when a booking arrives via webhook or needs to be
 * persisted outside the normal confirm flow (e.g. zero-price / direct bookings).
 */
export async function POST(req: NextRequest) {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    try {
        const body = await req.json() as Record<string, any>;
        const { bookingId } = body;
        if (!bookingId) {
            return Response.json({ success: false, error: 'bookingId is required' }, { status: 400 });
        }

        const sql = getSqlAdmin();
        await sql`
            INSERT INTO bookings (
                booking_id, user_id, property_name, property_image, room_name,
                check_in, check_out, guests_adults, guests_children,
                total_price, currency,
                holder_first_name, holder_last_name, holder_email,
                status, special_requests, policy_type,
                provider, payment_intent_id
            ) VALUES (
                ${bookingId},
                ${user.id},
                ${body.propertyName     ?? ''},
                ${body.propertyImage    ?? null},
                ${body.roomName         ?? ''},
                ${body.checkIn          ?? null}::date,
                ${body.checkOut         ?? null}::date,
                ${body.adults           ?? 1},
                ${body.children         ?? 0},
                ${body.totalPrice       ?? 0},
                ${body.currency         ?? 'USD'},
                ${body.holderFirstName  ?? ''},
                ${body.holderLastName   ?? ''},
                ${body.holderEmail      ?? user.email ?? ''},
                ${body.status           ?? 'confirmed'},
                ${body.specialRequests  ?? null},
                ${body.policyType       ?? 'non_refundable'},
                ${body.provider         ?? 'travelgatex'},
                ${body.paymentIntentId  ?? null}
            )
            ON CONFLICT (booking_id) DO UPDATE SET
                status         = EXCLUDED.status,
                total_price    = EXCLUDED.total_price,
                special_requests = EXCLUDED.special_requests
        `;

        revalidatePath('/trips');
        return Response.json({ success: true, data: { bookingId } });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/save') }, { status: 500 });
    }
}
