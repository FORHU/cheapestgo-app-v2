/**
 * BFF (Backend for Frontend) Proxy Utilities
 *
 * Bridges the gap between the Next.js Lucia session (cg-session cookie)
 * and the Express backend's JWT auth (access_token / Bearer token).
 *
 * Flow:
 *   1. Read cg-session cookie from the incoming request
 *   2. Validate via Lucia → get user { id, email, role }
 *   3. Generate a short-lived JWT that the backend understands
 *   4. Forward the request to the backend with Authorization: Bearer <jwt>
 */

import jwt from 'jsonwebtoken';
import { getSession } from '@/lib/auth/session';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v2';
const JWT_SECRET = process.env.BACKEND_JWT_SECRET ?? process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn('[bff] WARNING: BACKEND_JWT_SECRET / JWT_SECRET not set. Authenticated backend calls will fail.');
}

/**
 * Validate the Lucia session from the request and generate a backend-compatible JWT.
 * Returns null if the user is not authenticated.
 */
export async function createBackendToken(): Promise<string | null> {
    const { user } = await getSession();
    if (!user || !JWT_SECRET) return null;

    const payload = { sub: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Forward a request to the backend, optionally attaching a JWT.
 */
export async function proxyToBackend(
    path: string,
    init: RequestInit,
    token: string | null,
): Promise<Response> {
    const url = `${BACKEND_URL}/${path}`;

    const headers = new Headers(init.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    // Remove host header — the backend will set its own
    headers.delete('host');

    return fetch(url, {
        ...init,
        headers,
    });
}