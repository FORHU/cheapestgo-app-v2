import { runTgxSearch } from '@/server/stays/travelgatex/search';
import { safeError } from '@/server/safe-error';
import { prebookSchema } from '@/lib/schemas/booking';
import { quoteTravelgateX } from '@/server/travelgatex';
import { rateLimit } from '@/server/rate-limit';
import { getSqlAdmin } from '@/server/db/postgres';
import { PREBOOK_QUOTE_TTL_MS } from '@/lib/pricing';
import { convertCurrencyStrict, refreshExchangeRates } from '@/server/currency';

export const maxDuration = 60;

function normalizeTgxCancelPolicy(tgxPolicy: any): object {
    if (!tgxPolicy) return {};
    const penalties: any[] = tgxPolicy.cancelPenalties || [];
    const refundable: boolean = tgxPolicy.refundable ?? false;
    const cancelPolicyInfos: object[] = [];
    if (refundable && penalties.length > 0) {
        cancelPolicyInfos.push({ cancelTime: penalties[0].deadline, amount: 0, currency: penalties[0].currency || 'USD', type: 'AMOUNT' });
    }
    for (const p of penalties) {
        cancelPolicyInfos.push({ cancelTime: p.deadline, amount: p.value ?? 0, currency: p.currency || 'USD', type: p.penaltyType || 'AMOUNT' });
    }
    return { refundableTag: refundable ? 'RFN' : 'NRFN', cancelPolicyInfos };
}

function roomNamesMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb || na.includes(nb) || nb.includes(na)) return true;
    const stopWords = new Set(['room', 'type', 'bed', 'with', 'and', 'the', 'for']);
    const wordsA = na.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const wordsB = new Set(nb.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)));
    return wordsA.filter(w => wordsB.has(w)).length >= 2;
}

function parseTgxOptionToken(token: string) {
    const segs: Record<string, string> = {};
    const separator = token.includes('!~|') ? '!~|' : '[';
    for (const seg of token.split(separator)) {
        if (seg.length > 1) segs[seg[0]] = seg.slice(1);
    }
    const parseYYMMDD = (v: string | undefined): string | null => {
        if (!v || v.length !== 6) return null;
        return `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
    };
    return {
        hotelCode:   segs['d'] || null,
        checkIn:     parseYYMMDD(segs['b']),
        checkOut:    parseYYMMDD(segs['c']),
        nationality: segs['h'] || 'US',
    };
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const rl = await rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'hotel-prebook' });
        if (!rl.success) {
            return Response.json({ success: false, error: 'Too many requests. Please wait a moment.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = prebookSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
        }

        if (parsed.data.offerId.startsWith('TGX:')) {
            const staleOptionRefId = parsed.data.offerId.slice(4);
            const adults   = parsed.data.adults   ?? 2;
            const children = parsed.data.children ?? 0;
            const currency = parsed.data.currency || 'USD';

            const { hotelCode, checkIn, checkOut, nationality } = parseTgxOptionToken(staleOptionRefId);
            if (!hotelCode || !checkIn || !checkOut) {
                console.error('[prebook/tgx] Could not parse hotel code or dates from token:', staleOptionRefId.substring(0, 80));
                return Response.json({ success: false, error: 'Invalid TGX offer ID — could not decode hotel details' }, { status: 400 });
            }

            console.log(`[prebook/tgx] Fresh search: hotel=${hotelCode} ${checkIn}→${checkOut} adults=${adults} nationality=${nationality}`);
            const freshResult = await runTgxSearch({
                hotelCode,
                checkin:  checkIn,
                checkout: checkOut,
                adults,
                children,
                currency,
                guest_nationality: nationality,
                bypassCache: true,
            });

            const freshRooms: any[] = (freshResult as any)?.data?.roomTypes || [];
            if (!freshRooms.length) {
                return Response.json({ success: false, error: 'Room is no longer available for the selected dates' }, { status: 409 });
            }

            const originalRoomName: string = parsed.data.roomName || '';
            const matchedRooms = originalRoomName ? freshRooms.filter(r => roomNamesMatch(r.roomName || r.roomType || '', originalRoomName)) : [];
            const otherRooms = originalRoomName ? freshRooms.filter(r => !roomNamesMatch(r.roomName || r.roomType || '', originalRoomName)) : freshRooms;
            const candidates = [...matchedRooms, ...otherRooms].slice(0, 5);

            if (candidates.length === 0) {
                return Response.json({ success: false, error: 'Room is no longer available for the selected dates' }, { status: 409 });
            }

            await new Promise(resolve => setTimeout(resolve, 1500));

            type QuoteWinner = { quote: any; token: string; room: any };
            const quoteAttempts: Promise<QuoteWinner>[] = [];

            for (const room of candidates) {
                const rOfferId: string = room?.offerId || '';
                if (!rOfferId.startsWith('TGX:')) continue;
                const rOptionId = rOfferId.slice(4);
                const rTgxId: string       = room?.rates?.[0]?._tgx?.id    || '';
                const rNativeToken: string = room?.rates?.[0]?._tgx?.token || '';
                const tokensToTry = [...new Set([rOptionId, rTgxId, rNativeToken].filter(Boolean))];
                for (const tok of tokensToTry) {
                    quoteAttempts.push(
                        quoteTravelgateX({ token: tok })
                            .then((res) => {
                                if (!res?.data) throw new Error('empty quote response');
                                console.log('[prebook/tgx] Quote succeeded | token:', tok.substring(0, 60));
                                return { quote: res.data, token: tok, room };
                            })
                            .catch((err) => {
                                console.warn('[prebook/tgx] Quote failed | token:', tok.substring(0, 40), ':', err?.message?.substring(0, 80));
                                throw err;
                            })
                    );
                }
            }

            if (quoteAttempts.length === 0) {
                return Response.json({ success: false, error: 'This room is currently unavailable for booking. Please try a different hotel or check back later.' }, { status: 409 });
            }

            let winner: QuoteWinner | null = null;
            try { winner = await Promise.any(quoteAttempts); } catch {}

            if (!winner) {
                console.warn('[prebook/tgx] All parallel Quote attempts failed');
                return Response.json({ success: false, error: 'This room is currently unavailable for booking. Please try a different hotel or check back later.' }, { status: 409 });
            }

            const { quote: optionQuote, token: quotedToken, room: successfulRoom } = winner;

            if (optionQuote.paymentType && optionQuote.paymentType !== 'MERCHANT') {
                console.error('[prebook/tgx] Non-MERCHANT paymentType:', optionQuote.paymentType);
                return Response.json({ success: false, error: 'This room is not available for online payment. Please contact support.' }, { status: 409 });
            }

            const bookToken = optionQuote.optionRefId || quotedToken;
            const prebookId = `TGX:${bookToken}`;
            const bookedRoomName: string = successfulRoom?.roomName || successfulRoom?.roomType || '';
            const roomSubstituted = originalRoomName ? !roomNamesMatch(bookedRoomName, originalRoomName) : false;
            console.log('[prebook/tgx] book token:', bookToken.substring(0, 60), '| room:', bookedRoomName, '| substituted:', roomSubstituted);

            const quotedNet     = optionQuote.price?.net || 0;
            const quotedGross   = optionQuote.price?.gross || optionQuote.price?.net || 0;
            const quotedCurrency = optionQuote.price?.currency || currency;

            try {
                const sql = getSqlAdmin();
                await sql`
                    INSERT INTO hotel_prebook_quotes
                        (prebook_id, net, gross, currency, room_name, check_in, check_out, expires_at)
                    VALUES
                        (${prebookId}, ${quotedNet}, ${quotedGross}, ${quotedCurrency.toUpperCase()},
                         ${bookedRoomName || null}, ${checkIn}, ${checkOut},
                         ${new Date(Date.now() + PREBOOK_QUOTE_TTL_MS).toISOString()})
                    ON CONFLICT (prebook_id) DO UPDATE SET
                        net       = EXCLUDED.net,
                        gross     = EXCLUDED.gross,
                        currency  = EXCLUDED.currency,
                        room_name = EXCLUDED.room_name,
                        check_in  = EXCLUDED.check_in,
                        check_out = EXCLUDED.check_out,
                        expires_at = EXCLUDED.expires_at
                `;
            } catch (persistErr) {
                console.error('[prebook/tgx] Failed to persist quote — checkout will reject this prebookId:', persistErr);
            }

            const quotedSubtotal = optionQuote.price?.net || 0;
            const quotedTaxes    = (optionQuote.price?.gross || 0) - (optionQuote.price?.net || 0);
            const quotedTotal    = optionQuote.price?.gross || optionQuote.price?.net || 0;
            const displayCurrency = currency.toUpperCase();

            let display: object | null = null;
            if (quotedCurrency.toUpperCase() === displayCurrency) {
                display = { currency: displayCurrency, subtotal: quotedSubtotal, taxes: quotedTaxes, total: quotedTotal, converted: false };
            } else {
                try {
                    await refreshExchangeRates();
                    const to = (n: number) => Math.round(convertCurrencyStrict(n, quotedCurrency, displayCurrency) * 100) / 100;
                    display = { currency: displayCurrency, subtotal: to(quotedSubtotal), taxes: to(quotedTaxes), total: to(quotedTotal), converted: true };
                } catch (fxErr: any) {
                    console.warn('[prebook/tgx] display conversion unavailable:', fxErr?.message);
                }
            }

            const effectiveCancelPolicy =
                optionQuote.cancelPolicy?.cancelPenalties?.length
                    ? optionQuote.cancelPolicy
                    : (successfulRoom?.cancelPolicy?.cancelPenalties?.length
                        ? successfulRoom.cancelPolicy
                        : optionQuote.cancelPolicy);

            return Response.json({
                success: true,
                data: {
                    prebookId,
                    provider: 'travelgatex',
                    price: { subtotal: quotedSubtotal, taxes: quotedTaxes, total: quotedTotal },
                    surcharges: optionQuote.surcharges || [],
                    currency: optionQuote.price?.currency || currency,
                    ...(display ? { display } : {}),
                    cancellationPolicies: normalizeTgxCancelPolicy(effectiveCancelPolicy),
                    boardCode: optionQuote.boardCode || '',
                    rooms: optionQuote.rooms || [],
                    ...(roomSubstituted && bookedRoomName && { roomSubstituted: true, substitutedRoomName: bookedRoomName }),
                },
            });
        }

        return Response.json({ success: false, error: 'This hotel is not available for instant online booking. Please try a different hotel.' }, { status: 400 });
    } catch (err) {
        return Response.json({ success: false, error: safeError(err, 'prebook') }, { status: 500 });
    }
}
