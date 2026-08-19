import { NextRequest, NextResponse } from 'next/server';
import { buildSearchQueryParams, fetchSearchProperties } from '@/server/stays/fetchSearchData';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const rawParams = await req.json();
        const queryParams = buildSearchQueryParams(rawParams);
        const result = await fetchSearchProperties(rawParams);
        return NextResponse.json({ ...result, queryParams });
    } catch (e: any) {
        console.error('[api/search] Error:', e?.message);
        return NextResponse.json(
            { properties: [], totalCount: 0, allMappable: [], error: 'Search failed' },
            { status: 500 },
        );
    }
}
