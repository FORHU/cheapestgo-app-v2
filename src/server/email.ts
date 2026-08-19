/**
 * Server-side email sending.
 * Stub implementation — wire up Resend/SendGrid by setting RESEND_API_KEY.
 * Ported from v1's src/lib/server/email.ts.
 */

const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'CheapestGo';
const BRAND_EMAIL = process.env.NEXT_PUBLIC_BRAND_EMAIL ?? 'no-reply@mail.cheapestgo.com';

interface BookingConfirmationParams {
    bookingId: string;
    email: string;
    guestName: string;
    hotelName: string;
    roomName: string;
    checkIn: string;
    checkOut: string;
    totalPrice: number;
    currency: string;
}

interface HotelRefundEmailParams {
    bookingId: string;
    email: string;
    guestName: string;
    hotelName: string;
    refundAmount: number;
    currency: string;
    reason?: string;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.log(`[email] No RESEND_API_KEY — skipping email to ${to}: ${subject}`);
        return;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${BRAND_NAME} <${BRAND_EMAIL}>`, to, subject, html }),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error(`[email] Resend failed ${res.status}:`, err.slice(0, 200));
    }
}

export async function sendBookingConfirmationEmail(params: BookingConfirmationParams): Promise<void> {
    try {
        const subject = `Booking Confirmed — ${params.hotelName}`;
        const html = `<p>Dear ${params.guestName},</p>
<p>Your booking at <strong>${params.hotelName}</strong> has been confirmed.</p>
<ul>
<li>Booking ID: ${params.bookingId}</li>
<li>Room: ${params.roomName}</li>
<li>Check-in: ${params.checkIn}</li>
<li>Check-out: ${params.checkOut}</li>
<li>Total: ${params.currency} ${params.totalPrice.toFixed(2)}</li>
</ul>
<p>Thank you for booking with ${BRAND_NAME}!</p>`;
        await sendViaResend(params.email, subject, html);
    } catch (e) {
        console.error('[email] sendBookingConfirmationEmail failed:', e);
    }
}

export async function sendHotelRefundEmail(params: HotelRefundEmailParams): Promise<void> {
    try {
        const subject = `Refund Processed — ${params.hotelName}`;
        const html = `<p>Dear ${params.guestName},</p>
<p>Your refund of <strong>${params.currency} ${params.refundAmount.toFixed(2)}</strong> for booking ${params.bookingId} has been processed.</p>
${params.reason ? `<p>Reason: ${params.reason}</p>` : ''}
<p>Please allow 5–10 business days for the refund to appear on your statement.</p>`;
        await sendViaResend(params.email, subject, html);
    } catch (e) {
        console.error('[email] sendHotelRefundEmail failed:', e);
    }
}
