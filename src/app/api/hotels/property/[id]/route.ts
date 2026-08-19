import { NextRequest } from 'next/server';
import { runTgxSearch } from '@/server/stays/travelgatex/search';
import { getSqlAdmin } from '@/server/db/postgres';
import { safeError } from '@/server/safe-error';
import type { PropertyApiResponse, RoomOption, RateRow, ReviewItem } from '@/features/hotels/types/property.types';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { id } = params;
    const url = req.nextUrl;
    const checkIn  = url.searchParams.get('checkIn')  ?? '';
    const checkOut = url.searchParams.get('checkOut') ?? '';
    const adults   = Number(url.searchParams.get('adults')   ?? '2');
    const children = Number(url.searchParams.get('children') ?? '0');

    if (!checkIn || !checkOut) {
        return Response.json({ error: 'checkIn and checkOut are required' } satisfies PropertyApiResponse, { status: 400 });
    }

    try {
        const [tgxResult, reviewItems] = await Promise.all([
            runTgxSearch({
                hotelCode: id,
                checkin:  checkIn,
                checkout: checkOut,
                adults,
                children,
                currency: 'USD',
                guest_nationality: 'US',
            }),
            fetchReviewItems(id),
        ]);

        const d = tgxResult?.data;
        if (!d) {
            return Response.json({ error: 'Hotel not found' } satisfies PropertyApiResponse, { status: 404 });
        }

        const rawTypes = d.roomTypes ?? [];
        console.log(`[property-route] hotelId=${id} roomTypes=${rawTypes.length} sample:`, rawTypes[0] ? { offerId: rawTypes[0].offerId, roomName: rawTypes[0].roomName, price: rawTypes[0].price, refundable: rawTypes[0].refundable, boardCode: rawTypes[0].boardCode } : null);
        const rooms: RoomOption[] = groupByRoomName(rawTypes);
        console.log(`[property-route] grouped rooms=${rooms.length} first rates=${rooms[0]?.rates?.length}`);

        const response: PropertyApiResponse = {
            content: {
                hotel_id:       id,
                name:           d.name ?? id,
                address:        d.address ?? null,
                city:           d.city ?? null,
                country:        d.country ?? null,
                star_rating:    d.starRating ?? null,
                description:    d.description ?? null,
                images:         Array.isArray(d.images) ? d.images : [],
                amenities:      Array.isArray(d.amenities) ? d.amenities : [],
                lat:            d.lat ?? null,
                lng:            d.lng ?? null,
            },
            reviews: {
                rating:        d.reviewRating ?? null,
                reviews_count: d.reviewCount  ?? 0,
            },
            reviewItems,
            rooms,
        };

        return Response.json(response);
    } catch (err) {
        console.error('[property-route] error:', err);
        return Response.json(
            { error: safeError(err, 'hotels/property') } satisfies PropertyApiResponse,
            { status: 500 },
        );
    }
}

const BOARD_LABELS: Record<string, string> = {
    RO: 'Room only', BB: 'Bed & Breakfast', HB: 'Half Board',
    FB: 'Full Board', AI: 'All Inclusive', SC: 'Self Catering',
    CB: 'Continental Breakfast', AB: 'American Breakfast', EB: 'English Breakfast',
    nomeal: 'Room only', breakfast: 'Breakfast included',
    halfboard: 'Half Board', fullboard: 'Full Board', allinclusive: 'All Inclusive',
};

function groupByRoomName(roomTypes: any[]): RoomOption[] {
    // Group all TGX options that share the same room name into one RoomOption
    const groups = new Map<string, any[]>();
    for (const rt of roomTypes) {
        const key = rt.roomName ?? 'Room';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(rt);
    }

    const result: RoomOption[] = [];
    for (const [name, opts] of groups) {
        // Sort cheapest first within the group
        opts.sort((a, b) => a.price - b.price);
        const best = opts[0];

        const rates: RateRow[] = opts.map(rt => ({
            offerId:              rt.offerId ?? '',
            price:                rt.price,
            currency:             rt.currency,
            boardCode:            rt.boardCode,
            boardName:            BOARD_LABELS[rt.boardCode] ?? rt.boardCode ?? 'Room only',
            refundable:           rt.refundable ?? false,
            refundableTag:        rt.refundableTag ?? 'NON_REFUNDABLE',
            cancellationDeadline: rt.cancelPolicy?.cancelPenalties?.[0]?.deadline,
        }));

        result.push({
            id:                   best.offerId ?? best.roomCode ?? name,
            offerId:              best.offerId,
            name,
            price:                best.price,
            currency:             best.currency,
            refundableTag:        best.refundableTag,
            boardType:            best.boardCode,
            boardName:            BOARD_LABELS[best.boardCode] ?? best.boardCode ?? 'Room only',
            cancellationDeadline: best.cancelPolicy?.cancelPenalties?.[0]?.deadline,
            cancelPolicy:         best.cancelPolicy,
            roomImages:           best.roomPhotos ?? [],
            rates,
        });
    }
    return result;
}

async function fetchReviewItems(hotelId: string): Promise<ReviewItem[]> {
    try {
        const sql = getSqlAdmin();
        // Strip TGX 'H' prefix to get ETG numeric id
        const etgId = hotelId.replace(/^H/i, '');
        const rows = await sql`
            SELECT reviewer_name, score, pros, cons, headline, country
            FROM hotel_review_items
            WHERE hotel_id = ${etgId}
            ORDER BY review_date DESC
            LIMIT 50
        `;
        return rows.map(r => ({
            reviewer_name: r.reviewer_name ?? null,
            score:         r.score         ?? null,
            pros:          r.pros          ?? null,
            cons:          r.cons          ?? null,
            headline:      r.headline      ?? null,
            country:       r.country       ?? null,
        }));
    } catch {
        return [];
    }
}
