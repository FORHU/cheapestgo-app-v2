/**
 * The hotel checkout's conversation with api-v2, as plain functions over an injected client.
 *
 * The page made these four calls inline, each with its own copy of the stay fields and its
 * own half-remembered idea of what a failure looked like. Pulling them here gives the calls
 * one shape and one home, and — because the client is a parameter — lets a test drive the
 * whole conversation without a browser, a network or Stripe.
 *
 * Two rules the functions enforce rather than the callers remember:
 *
 *  - The amount charged comes from the server's `display` block, never from anything the
 *    browser worked out. `createHotelPayment` refuses to run without one.
 *  - Who is staying travels with **create-payment** as well as confirm. That is what lets
 *    api-v2 finish the booking from Stripe's authorisation event if this tab closes between
 *    paying and confirming.
 *
 * Errors are thrown as `http` throws them; classifying them is the caller's job
 * (`classifyCheckoutError`). A confirm that did not confirm is **not** an error — it is a
 * response with a meaning, and it is returned as one.
 */

import { classifyConfirmResponse, type ConfirmOutcome } from './checkout-errors';
import type { HotelQuote, HotelDisplay, PriceChange } from './hotel-checkout-machine';
import type { HotelGuestPayload } from './hotel-guest-form';

/** The slice of `shared/lib/http` this module needs. */
export interface CheckoutHttp {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
}

export interface StayDetails {
    hotelName:  string;
    roomName:   string;
    hotelImage: string;
    checkIn:    string;
    checkOut:   string;
    adults:     number;
    children:   number;
    /** The currency the traveller is shopping in. */
    currency:   string;
}

// ─── Quote ────────────────────────────────────────────────────────────────────

interface PrebookResponse {
    success: boolean;
    data: {
        prebookId:            string;
        display?:             HotelDisplay;
        boardCode?:           string;
        priceChange?:         PriceChange;
        roomSubstituted?:     boolean;
        substitutedRoomName?: string;
    };
}

export async function requestQuote(
    client: CheckoutHttp,
    input: {
        rateKey:   string;
        roomName:  string;
        adults:    number;
        children:  number;
        currency:  string;
        /** The room total the traveller was last *shown by the server*, in `currency`. */
        expectedTotal?: number;
    },
): Promise<HotelQuote> {
    const res = await client.post<PrebookResponse>('/api/hotels/prebook', {
        offerId:  input.rateKey,
        roomName: input.roomName,
        adults:   input.adults,
        children: input.children,
        currency: input.currency,
        ...(input.expectedTotal && input.expectedTotal > 0 ? { expectedTotal: input.expectedTotal } : {}),
    });

    const d = res.data;
    return {
        prebookId: d.prebookId,
        ...(d.display ? { display: d.display } : {}),
        ...(d.boardCode ? { board: d.boardCode } : {}),
        ...(d.priceChange ? { priceChange: d.priceChange } : {}),
        ...(d.roomSubstituted ? { roomSubstituted: true, substitutedRoomName: d.substitutedRoomName } : {}),
    };
}

// ─── Payment ──────────────────────────────────────────────────────────────────

interface CallInput {
    quote:            HotelQuote;
    guest:            HotelGuestPayload;
    stay:             StayDetails;
    /**
     * The room total the page arrived with. A placeholder, as `checkoutMoney` says: it is sent
     * only as the confirm call's `quotedPrice` guard, and never as an amount to charge.
     */
    placeholderTotal: number;
}

/** What both create-payment and confirm carry about the stay and who is in it. */
function stayBody(input: CallInput) {
    const { guest, stay, quote, placeholderTotal } = input;
    return {
        holder:       guest.holder,
        ...(guest.holderPhone ? { holderPhone: guest.holderPhone } : {}),
        guests:       guest.guests,
        propertyName: stay.hotelName,
        ...(stay.hotelImage ? { propertyImage: stay.hotelImage } : {}),
        roomName:     stay.roomName,
        checkIn:      stay.checkIn,
        checkOut:     stay.checkOut,
        adults:       stay.adults,
        children:     stay.children,
        ...(guest.specialRequests ? { specialRequests: guest.specialRequests } : {}),
        ...(quote.board ? { board: quote.board } : {}),
        ...(placeholderTotal > 0 ? { quotedPrice: placeholderTotal } : {}),
    };
}

export interface PaymentReady {
    clientSecret:    string;
    paymentIntentId: string;
    chargedTotal?:   number;
    serviceFee?:     number;
}

export async function createHotelPayment(client: CheckoutHttp, input: CallInput): Promise<PaymentReady> {
    const display = input.quote.display;
    if (!display) {
        // Charging from a figure the browser made up is exactly what this flow was rebuilt to
        // stop. Without the server's, there is nothing honest to charge.
        throw new Error('We could not confirm the price in your currency just now. Please try again in a moment.');
    }

    const res = await client.post<{
        success: boolean;
        data: { clientSecret: string; paymentIntentId: string; chargedTotal?: number; serviceFee?: number };
    }>('/api/hotels/create-payment', {
        prebookId:      input.quote.prebookId,
        amount:         display.total,
        currency:       display.currency,
        // What the summary showed, fee included — nothing is billed above it.
        displayedTotal: display.chargedTotal,
        holderEmail:    input.guest.holder.email,
        ...stayBody(input),
    });

    const { clientSecret, paymentIntentId, chargedTotal, serviceFee } = res.data;
    return {
        clientSecret, paymentIntentId,
        ...(typeof chargedTotal === 'number' ? { chargedTotal } : {}),
        ...(typeof serviceFee === 'number' ? { serviceFee } : {}),
    };
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

export async function confirmHotelBooking(
    client: CheckoutHttp,
    input: CallInput & { paymentIntentId: string },
): Promise<ConfirmOutcome> {
    const res = await client.post<unknown>('/api/hotels/confirm', {
        paymentIntentId: input.paymentIntentId,
        prebookId:       input.quote.prebookId,
        currency:        input.stay.currency,
        ...stayBody(input),
    });
    return classifyConfirmResponse(res);
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface BookingStatusData {
    reference:     string;
    status:        string | null;
    bookingStatus: string | null;
    failure:       { code?: string; message?: string | null } | null;
}

/**
 * A booking's status as the confirmation page and the poll understand it.
 *
 * `pending` here means "not settled yet", which is not a failure: the supplier is being
 * asked, or another caller holds the claim. Callers keep asking.
 */
export function outcomeFromStatus(data: BookingStatusData): ConfirmOutcome {
    const reference = data.reference;

    switch (data.status) {
        case 'CONFIRMED':
        case 'CANCEL_REQUESTED':
        case 'CANCELLED':
        case 'REFUND_PENDING':
        case 'REFUNDED':
        case 'REFUND_FAILED':
            return { kind: 'confirmed', reference, status: data.bookingStatus ?? 'confirmed' };
        case 'NEEDS_REVIEW':
            return {
                kind: 'needs_review', reference,
                message: data.failure?.message ?? 'We are confirming this booking with the hotel.',
            };
        case 'FAILED':
        case 'EXPIRED':
            return {
                kind: 'failed', released: true,
                message: data.failure?.message ?? 'This booking could not be completed.',
            };
        case null:
        case undefined:
            // From before the lifecycle: the sale's own status is all there is.
            if (data.bookingStatus === 'confirmed') return { kind: 'confirmed', reference, status: 'confirmed' };
            return { kind: 'pending', reference, message: 'Checking your booking…' };
        default:
            return { kind: 'pending', reference, message: 'Your booking is being confirmed.' };
    }
}

export async function fetchBookingOutcome(client: CheckoutHttp, reference: string): Promise<ConfirmOutcome> {
    const res = await client.get<{ success: boolean; data: BookingStatusData }>(
        `/hotels/bookings/${encodeURIComponent(reference)}`,
    );
    return outcomeFromStatus(res.data);
}
