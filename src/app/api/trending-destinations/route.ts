import { NextResponse } from 'next/server';

export async function GET() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return NextResponse.json({ success: true, data: [] });

    try {
        const res = await fetch(`${apiBase}/hotels/trending`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return NextResponse.json({ success: true, data: [] });
        const json = await res.json();
        return NextResponse.json(json);
    } catch {
        return NextResponse.json({ success: true, data: [] });
    }
}
