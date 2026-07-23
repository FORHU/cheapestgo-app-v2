/**
 * Catch-all BFF proxy route.
 *
 * Matches: /api/bff/*
 * Forwards to: NEXT_PUBLIC_API_URL/*
 *
 * Authenticates using the Lucia cg-session cookie → generates a backend JWT.
 * All HTTP methods are supported (GET, POST, PUT, PATCH, DELETE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBackendToken, proxyToBackend } from '@/lib/bff/proxy';

export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const backendPath = path.join('/');

    // Clone the body if present (can only read body once)
    let body: BodyInit | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.arrayBuffer();
    }

    // Build headers to forward (skip hop-by-hop headers)
    const forwardHeaders = new Headers();
    const skipHeaders = new Set([
        'host', 'connection', 'keep-alive', 'transfer-encoding',
        'te', 'trailer', 'upgrade', 'authorization', 'cookie',
    ]);
    request.headers.forEach((value, key) => {
        if (!skipHeaders.has(key.toLowerCase())) {
            forwardHeaders.set(key, value);
        }
    });

    // Generate a backend JWT from the Lucia session (null if not authenticated)
    const token = await createBackendToken();

    // Forward to backend
    const backendResponse = await proxyToBackend(
        backendPath,
        {
            method: request.method,
            headers: forwardHeaders,
            body,
        },
        token,
    );

    // Stream the backend response back to the client
    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
        // Skip hop-by-hop headers
        if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
            responseHeaders.set(key, value);
        }
    });

    return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: responseHeaders,
    });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };