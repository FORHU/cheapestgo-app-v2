import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const hotelId = params.id;
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const res = await fetch(`${apiBase}/hotels/property/${hotelId}/reviews`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(8000),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
