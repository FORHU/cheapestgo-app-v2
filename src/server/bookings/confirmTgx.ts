/**
 * TravelgateX booking confirm + DB save.
 * Ported from v1's src/lib/server/bookings.ts (confirmAndSaveTgxBooking section).
 * Key differences: no Supabase — everything uses getSqlAdmin(); no invokeEdgeFunction
 * — calls quoteTravelgateX() directly.
 */

import { getSqlAdmin } from '@/server/db/postgres';
import { bookTravelgateX, quoteTravelgateX } from '@/server/travelgatex';
import { runTgxSearch } from '@/server/stays/travelgatex/search';
import { stripe } from '@/server/stripe';
import { lockFx } from '@/server/bookings/fxLock';
import type { SessionUser } from '@/server/auth/session';

export interface TgxConfirmInput {
    quoteToken: string;
    holder: { firstName: string; lastName: string; email: string };
    guests: Array<{ firstName: string; lastName: string; age?: number }>;
    propertyName: string;
    propertyImage?: string;
    roomName: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    currency: string;
    specialRequests?: string;
    paymentIntentId?: string;
    voucherCode?: string;
    discountAmount?: number;
    cancellationPolicies?: any;
    quotedPrice?: number;
}

export interface ConfirmAndSaveResult {
    success: boolean;
    providerConfirmed?: boolean;
    data?: {
        bookingId: string;
        status: string;
        policyType: string;
        policySummary: string;
        totalPrice?: number;
        currency?: string;
    };
    error?: string;
    errorCode?: string;
    oldPrice?: number;
    newPrice?: number;
}

function parseTgxToken(token: string): { hotelCode: string | null; checkIn: string | null; checkOut: string | null; nationality: string } {
    const segs: Record<string, string> = {};
    const separator = token.includes('!~|') ? '!~|' : '[';
    for (const seg of token.split(separator)) {
        if (seg.length > 1) segs[seg[0]] = seg.slice(1);
    }
    const parseYYMMDD = (v: string | undefined): string | null => {
        if (!v || v.length !== 6) return null;
        return `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
    };
    return { hotelCode: segs['d'] || null, checkIn: parseYYMMDD(segs['b']), checkOut: parseYYMMDD(segs['c']), nationality: segs['h'] || 'US' };
}

async function getFreshTgxToken(expiredToken: string, adults: number, children: number, currency: string): Promise<string | null> {
    const { hotelCode, checkIn, checkOut, nationality } = parseTgxToken(expiredToken);
    if (!hotelCode || !checkIn || !checkOut) return null;
    try {
        const result = await runTgxSearch({ hotelCode, checkin: checkIn, checkout: checkOut, adults, children, currency, guest_nationality: nationality });
        const rooms: any[] = (result as any)?.data?.roomTypes || [];
        const freshRoom = rooms[0];
        const freshOfferId: string = freshRoom?.offerId || '';
        if (!freshOfferId.startsWith('TGX:')) return null;
        const freshOptionId = freshOfferId.slice(4);
        const freshNativeToken: string = freshRoom?.rates?.[0]?._tgx?.token || freshOptionId;
        await new Promise(resolve => setTimeout(resolve, 1500));
        const tokensToTry = freshNativeToken !== freshOptionId ? [freshNativeToken, freshOptionId] : [freshOptionId];
        for (const tok of tokensToTry) {
            try {
                const quoteResult = await quoteTravelgateX({ token: tok });
                return quoteResult?.data?.optionRefId || tok;
            } catch {}
        }
        return null;
    } catch { return null; }
}

export async function confirmAndSaveTgxBooking(params: TgxConfirmInput, user: SessionUser): Promise<ConfirmAndSaveResult> {
    const clientReference = `FORHU-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const tokenDates = parseTgxToken(params.quoteToken);
    const checkIn  = tokenDates.checkIn  ?? params.checkIn;
    const checkOut = tokenDates.checkOut ?? params.checkOut;

    const adultPaxes = Array(params.adults).fill(null).map((_, i) => ({
        name: params.guests[i]?.firstName || params.holder.firstName,
        surname: params.guests[i]?.lastName || params.holder.lastName,
        age: 30,
    }));
    const childPaxes = Array(params.children).fill(null).map((_, i) => ({
        name: params.guests[params.adults + i]?.firstName || `Child${i + 1}`,
        surname: params.guests[params.adults + i]?.lastName || params.holder.lastName,
        age: (params.guests[params.adults + i] as any)?.age || 10,
    }));

    let tgxResult: any;
    let activeToken = params.quoteToken;
    try {
        tgxResult = await bookTravelgateX({
            quoteToken: activeToken,
            clientReference,
            holder: params.holder,
            rooms: [{ occupancyRefId: 1, paxes: [...adultPaxes, ...childPaxes] }],
        });
    } catch (firstError: any) {
        const msg = firstError?.message || '';
        const isExpired = /option not found|not found in|expired|unavailable|301|wrong_field|quote.*option|search.*found/i.test(msg);
        if (isExpired) {
            const freshToken = await getFreshTgxToken(activeToken, params.adults, params.children, params.currency);
            if (freshToken) {
                activeToken = freshToken;
                try {
                    tgxResult = await bookTravelgateX({
                        quoteToken: freshToken,
                        clientReference,
                        holder: params.holder,
                        rooms: [{ occupancyRefId: 1, paxes: [...adultPaxes, ...childPaxes] }],
                    });
                } catch (retryError: any) {
                    return { success: false, error: retryError instanceof Error ? retryError.message : 'TravelgateX booking failed after retry' };
                }
            } else {
                return { success: false, error: 'Room is no longer available for these dates' };
            }
        } else {
            return { success: false, error: firstError instanceof Error ? firstError.message : 'TravelgateX booking failed' };
        }
    }

    const booking = tgxResult?.data;
    const clientRef = booking?.clientRef || booking?.reference?.client;
    if (!clientRef) return { success: false, error: 'Booking failed — no reference returned from TravelgateX' };

    const bookingId = clientRef;
    const supplierRef = booking?.supplierRef || booking?.reference?.supplier;
    const hotelRef = booking?.hotelRef || booking?.reference?.hotel;
    const hotelCode = booking?.hotelCode ?? null;
    const rawStatus = (booking.status || 'confirmed').toLowerCase();
    const bookingStatus = (['confirmed', 'pending'].includes(rawStatus) ? rawStatus : 'confirmed') as 'confirmed' | 'pending';

    console.log(JSON.stringify({ _event: 'tgx_confirmed', bookingId, clientReference, supplierRef, userId: user.id, holderEmail: params.holder.email, propertyName: params.propertyName, checkIn, checkOut, timestamp: new Date().toISOString() }));

    const price = booking.price?.gross || booking.price?.net || 0;
    const currency = booking.price?.currency || params.currency || 'USD';

    if (params.quotedPrice && params.quotedPrice > 0 && price > 0 && price > params.quotedPrice * 1.05) {
        console.warn(`[confirmAndSaveTgxBooking] Price increased: quoted=${params.quotedPrice} booked=${price}`);
        return { success: false, errorCode: 'price_changed', oldPrice: params.quotedPrice, newPrice: price };
    }

    let totalPrice: number;
    let storedCurrency = currency;
    if (params.paymentIntentId) {
        try {
            const pi = await stripe.paymentIntents.retrieve(params.paymentIntentId);
            totalPrice = pi.amount / 100;
            storedCurrency = (pi.currency || 'usd').toUpperCase();
        } catch {
            totalPrice = params.quotedPrice ?? price;
        }
    } else {
        totalPrice = params.quotedPrice ?? price;
    }

    const prebookPolicy = params.cancellationPolicies;
    const hasPrebookPolicy = prebookPolicy != null && typeof prebookPolicy === 'object' && Object.keys(prebookPolicy).length > 0;
    const isRefundable = hasPrebookPolicy
        ? (prebookPolicy.refundableTag === 'RFN' || prebookPolicy.refundableTag === 'REFUNDABLE')
        : booking.cancelPolicy?.refundable === true;
    const policyType = isRefundable ? 'free_cancellation' : 'non_refundable';
    const storedCancelPolicy = hasPrebookPolicy ? prebookPolicy : (booking.cancelPolicy ? {
        refundableTag: isRefundable ? 'RFN' : 'NRFN',
        cancelPolicyInfos: (booking.cancelPolicy.cancelPenalties || []).map((p: any) => ({
            cancelTime: p.deadline, amount: p.value ?? 0, currency: p.currency || storedCurrency, type: p.penaltyType || 'AMOUNT',
        })),
    } : null);

    let property_lat = 0;
    let property_lng = 0;
    if (hotelCode) {
        try {
            const sql = getSqlAdmin();
            const rows = await sql`SELECT lat, lng FROM hotel_content WHERE hotel_id = ${hotelCode} AND lat != 0 AND lng != 0 LIMIT 1`;
            if (rows[0]) { property_lat = rows[0].lat; property_lng = rows[0].lng; }
        } catch {}
    }

    try {
        const sql = getSqlAdmin();
        const freeCancelDeadline = booking.cancelPolicy?.cancelPenalties?.[0]?.deadline ?? null;
        const cancelPenalties: any[] = booking.cancelPolicy?.cancelPenalties || [];

        await sql`
            INSERT INTO bookings (
                booking_id, user_id, property_name, property_image, room_name,
                check_in, check_out, guests_adults, guests_children,
                total_price, currency,
                holder_first_name, holder_last_name, holder_email,
                status, special_requests, voucher_code, discount_amount,
                policy_type, cancellation_policy,
                provider, provider_metadata, payment_intent_id,
                supplier_cost, charged_price
            ) VALUES (
                ${bookingId}, ${user.id}, ${params.propertyName}, ${params.propertyImage ?? null}, ${params.roomName},
                ${checkIn}::date, ${checkOut}::date,
                ${params.adults}, ${params.children ?? 0},
                ${totalPrice}, ${storedCurrency},
                ${params.holder.firstName}, ${params.holder.lastName}, ${params.holder.email},
                ${bookingStatus}, ${params.specialRequests ?? null}, ${params.voucherCode ?? null}, ${params.discountAmount ?? 0},
                ${policyType}, ${storedCancelPolicy ? JSON.stringify(storedCancelPolicy) : null}::jsonb,
                'travelgatex', ${JSON.stringify({ supplierRef, hotelRef, hotelCode, clientReference })}::jsonb,
                ${params.paymentIntentId ?? null},
                ${price}, ${totalPrice}
            )
        `;

        try {
            const fx = await lockFx(totalPrice, storedCurrency);
            await sql`
                UPDATE bookings
                SET property_lat = ${property_lat}, property_lng = ${property_lng},
                    source_brand = ${process.env.NEXT_PUBLIC_BRAND_NAME ?? 'CheapestGo'},
                    usd_amount = ${fx.usd_amount}, fx_rate = ${fx.fx_rate},
                    fx_captured_at = ${fx.fx_captured_at}, fx_source = ${fx.fx_source}
                WHERE booking_id = ${bookingId}
            `;
        } catch {}

        const snapshotRows = await sql`
            INSERT INTO booking_policy_snapshots (
                booking_id, policy_type, summary, refundable_tag, hotel_remarks,
                no_show_penalty, early_departure_fee, free_cancel_deadline,
                raw_liteapi_response, captured_at
            ) VALUES (
                ${bookingId},
                ${policyType}::booking_policy_type,
                ${isRefundable ? 'Refundable rate' : 'Non-refundable rate'},
                ${isRefundable ? 'RFN' : 'NRFN'},
                '{}', 0, 0,
                ${freeCancelDeadline ? sql`${freeCancelDeadline}::timestamptz` : sql`NULL`},
                ${JSON.stringify(booking)}::jsonb,
                NOW()
            )
            RETURNING id
        `;
        const snapshotId = snapshotRows[0]?.id ?? null;

        if (snapshotId) {
            await sql`UPDATE bookings SET policy_snapshot_id = ${snapshotId} WHERE booking_id = ${bookingId}`;
            for (let i = 0; i < cancelPenalties.length; i++) {
                const p = cancelPenalties[i];
                await sql`
                    INSERT INTO policy_tiers (snapshot_id, cancel_deadline, penalty_amount, penalty_type, currency, tier_order)
                    VALUES (
                        ${snapshotId},
                        ${p.deadline ? sql`${p.deadline}::timestamptz` : sql`NULL`},
                        ${p.value ?? 0}, ${p.penaltyType || 'fixed'},
                        ${p.currency || currency}, ${i}
                    )
                `;
            }
        }

        if (params.paymentIntentId) {
            try {
                await stripe.paymentIntents.update(params.paymentIntentId, { metadata: { bookingId } });
            } catch (e: any) {
                console.warn('[confirmAndSaveTgxBooking] PI metadata update failed:', e.message);
            }
        }

        return {
            success: true,
            data: { bookingId, status: bookingStatus, policyType, policySummary: isRefundable ? 'Refundable rate' : 'Non-refundable rate', totalPrice, currency: storedCurrency },
        };
    } catch (error) {
        console.error('[confirmAndSaveTgxBooking] DB error after TGX confirmed:', error);
        try {
            const sqlEmergency = getSqlAdmin();
            const emergencyNote = [params.specialRequests, '[EMERGENCY_RECOVERY]'].filter(Boolean).join(' | ');
            await sqlEmergency`
                INSERT INTO bookings (
                    booking_id, user_id, property_name, property_image, room_name,
                    check_in, check_out, guests_adults, guests_children,
                    total_price, currency,
                    holder_first_name, holder_last_name, holder_email,
                    status, special_requests, voucher_code, discount_amount,
                    policy_type, cancellation_policy,
                    provider, provider_metadata, payment_intent_id,
                    supplier_cost, charged_price
                ) VALUES (
                    ${bookingId}, ${user.id}, ${params.propertyName}, ${params.propertyImage ?? null}, ${params.roomName},
                    ${checkIn}::date, ${checkOut}::date,
                    ${params.adults}, ${params.children ?? 0},
                    ${totalPrice}, ${storedCurrency},
                    ${params.holder.firstName}, ${params.holder.lastName}, ${params.holder.email},
                    ${bookingStatus}, ${emergencyNote}, ${params.voucherCode ?? null}, ${params.discountAmount ?? 0},
                    ${policyType}, ${storedCancelPolicy ? JSON.stringify(storedCancelPolicy) : null}::jsonb,
                    'travelgatex', ${JSON.stringify({ supplierRef, hotelRef, hotelCode, clientReference })}::jsonb,
                    ${params.paymentIntentId ?? null},
                    ${price}, ${totalPrice}
                )
            `;
            return { success: true, data: { bookingId, status: bookingStatus, policyType, policySummary: isRefundable ? 'Refundable' : 'Non-refundable', totalPrice, currency: storedCurrency } };
        } catch (emergencyErr) {
            console.error('CRITICAL: Emergency INSERT also failed for', bookingId, ':', emergencyErr);
        }
        return {
            success: false,
            providerConfirmed: true,
            data: { bookingId, status: bookingStatus, policyType, policySummary: isRefundable ? 'Refundable' : 'Non-refundable', totalPrice, currency: storedCurrency },
            error: 'Booking confirmed but failed to save. Contact support with booking ID: ' + bookingId,
        };
    }
}
