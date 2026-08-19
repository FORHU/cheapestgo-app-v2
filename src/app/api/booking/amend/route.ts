import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { getSqlAdmin } from '@/server/db/postgres';
import { createNotification } from '@/server/admin/notify';
import { sendHotelAmendmentEmail } from '@/server/email';
import { safeError } from '@/server/safe-error';
import { checkCsrf } from '@/server/csrf';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const { user } = await getSession();
    if (!user) {
        return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    try {
        const body = await req.json() as {
            bookingId?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            remarks?: string;
        };

        if (!body.bookingId) {
            return Response.json({ success: false, error: 'bookingId is required' }, { status: 400 });
        }

        const sql = getSqlAdmin();

        // Verify ownership
        const existing = await sql`
            SELECT booking_id, property_name, holder_email
            FROM bookings
            WHERE booking_id = ${body.bookingId} AND user_id = ${user.id}
            LIMIT 1
        `;
        if (!existing.length) {
            return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
        }

        // Build update — only set fields that were provided
        const updates: Record<string, string> = {};
        if (body.firstName) updates.holder_first_name = body.firstName;
        if (body.lastName)  updates.holder_last_name  = body.lastName;
        if (body.email)     updates.holder_email      = body.email;
        if (body.remarks)   updates.special_requests  = body.remarks;

        if (!Object.keys(updates).length) {
            return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        await sql`
            UPDATE bookings SET
                holder_first_name = COALESCE(${body.firstName ?? null}, holder_first_name),
                holder_last_name  = COALESCE(${body.lastName  ?? null}, holder_last_name),
                holder_email      = COALESCE(${body.email     ?? null}, holder_email),
                special_requests  = COALESCE(${body.remarks   ?? null}, special_requests)
            WHERE booking_id = ${body.bookingId} AND user_id = ${user.id}
        `;

        revalidatePath('/trips');
        createNotification('Booking Amended', `Booking amended by ${user.email}.`, 'booking');

        const changes = [
            body.firstName || body.lastName ? 'Guest name' : '',
            body.email   ? 'Email'            : '',
            body.remarks ? 'Special requests' : '',
        ].filter(Boolean).join(', ') || 'Booking details';

        sendHotelAmendmentEmail({
            bookingId: body.bookingId,
            email: body.email || existing[0].holder_email || user.email || '',
            guestName: `${body.firstName || ''} ${body.lastName || ''}`.trim(),
            hotelName: existing[0].property_name || '',
            changes,
        }).catch(e => console.error('[amend] Email error:', e));

        return Response.json({ success: true, data: { bookingId: body.bookingId } });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'booking/amend') }, { status: 500 });
    }
}
