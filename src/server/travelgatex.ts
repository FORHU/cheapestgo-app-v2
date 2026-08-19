/**
 * TravelgateX gateway — server-side only.
 * Ported from v1's src/lib/server/travelgatex.ts.
 */

import { tgxGraphQL, getTgxSettings, buildOccupancies, normalizeOption, type TgxOption } from '@/server/stays/travelgatex/client';
import { runTgxSearch, type TgxSearchParams } from '@/server/stays/travelgatex/search';

const TGX_QUOTE_QUERY = `
query TgxQuote($criteria: HotelCriteriaQuoteInput!, $settings: HotelSettingsInput!) {
  hotelX {
    quote(criteria: $criteria, settings: $settings) {
      optionQuote {
        optionRefId hotelCode boardCode paymentType status
        price { currency net gross }
        surcharges { chargeType mandatory price { net gross currency } }
        rooms { code description occupancyRefId }
        cancelPolicy {
          refundable
          cancelPenalties { deadline hoursBefore penaltyType currency value }
        }
      }
      errors { code type description }
    }
  }
}`;

async function callTgxQuoteDirect(token: string) {
    const settings = getTgxSettings();
    const result = await tgxGraphQL(TGX_QUOTE_QUERY, {
        criteria: { optionRefId: token },
        settings,
    });
    const quote = result?.data?.hotelX?.quote?.optionQuote;
    const errors: any[] = result?.data?.hotelX?.quote?.errors || [];
    if (errors.length) {
        const msg = errors.map((e: any) => e.description || e.code).join('; ');
        throw new Error(msg);
    }
    if (!quote) throw new Error('No quote returned from TravelgateX');
    return {
        success: true,
        data: {
            optionRefId:  quote.optionRefId || token,
            hotelCode:    quote.hotelCode,
            boardCode:    quote.boardCode,
            paymentType:  quote.paymentType,
            status:       quote.status,
            price: {
                net:      quote.price?.net   ?? 0,
                gross:    quote.price?.gross ?? 0,
                currency: quote.price?.currency ?? 'USD',
            },
            surcharges:   quote.surcharges ?? [],
            rooms:        quote.rooms ?? [],
            cancelPolicy: quote.cancelPolicy,
        },
    };
}

export { tgxGraphQL, getTgxSettings, buildOccupancies, normalizeOption };
export type { TgxOption };

async function callInternalRoute(path: string, body: object) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
    const secret = process.env.FUNCTIONS_SECRET || process.env.INTERNAL_SECRET;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['Authorization'] = `Bearer ${secret}`;
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text.slice(0, 200);
        try { const parsed = JSON.parse(text); if (parsed?.error) message = String(parsed.error); } catch {}
        throw new Error(message);
    }
    return res.json();
}

export async function searchTravelgateX(params: TgxSearchParams) { return runTgxSearch(params); }
export async function quoteTravelgateX(params: { token: string }) { return callTgxQuoteDirect(params.token); }

export async function bookTravelgateX(params: {
    quoteToken: string;
    clientReference: string;
    holder: { firstName: string; lastName: string; email: string };
    rooms: Array<{ occupancyRefId: number; paxes: Array<{ name: string; surname: string; age: number }> }>;
}) { return callInternalRoute('/api/fn/travelgatex-book', params); }

export async function cancelTravelgateX(params: {
    clientReference: string;
    supplierReference?: string;
    tgxBookingId?: string;
    hotelCode?: string;
}) { return callInternalRoute('/api/fn/travelgatex-cancel', params); }
