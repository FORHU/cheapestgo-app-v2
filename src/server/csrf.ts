import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = (() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cheapestgo.com';
    const origins = new Set([siteUrl.replace(/\/$/, '')]);
    origins.add('https://geomeego.com');
    if (process.env.NODE_ENV !== 'production') {
        origins.add('http://localhost:3000');
        origins.add('http://localhost:3001');
        origins.add('http://127.0.0.1:3000');
        origins.add('http://127.0.0.1:3001');
    }
    return origins;
})();

export function checkCsrf(req: NextRequest): NextResponse | null {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return null;
    const requestedBy = req.headers.get('x-requested-by');
    if (requestedBy === 'cheapestgo-client') return null;
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const requestOrigin = origin ?? (referer ? new URL(referer).origin : null);
    if (requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)) return null;
    console.warn(`[csrf] Blocked — origin: ${requestOrigin}, x-requested-by: ${requestedBy}`);
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}
