import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db/postgres';

export async function GET(req: NextRequest) {
    const city = req.nextUrl.searchParams.get('city')?.trim();
    const cc   = req.nextUrl.searchParams.get('cc')?.trim().toUpperCase();

    if (!city) return NextResponse.json({ count: 0 });

    try {
        const sql = getSql();
        const [row] = await sql<{ count: string }[]>`
            SELECT COUNT(*) AS count
            FROM hotel_content
            WHERE LOWER(city) = LOWER(${city})
            ${cc ? sql`AND country = ${cc}` : sql``}
        `;
        return NextResponse.json({ count: parseInt(row?.count ?? '0', 10) });
    } catch {
        return NextResponse.json({ count: 0 });
    }
}
