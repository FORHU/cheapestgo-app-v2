/**
 * HTTP client for backend API calls.
 *
 * All requests go through the BFF proxy at /api/bff/* which:
 *   1. Reads the cg-session cookie (Lucia)
 *   2. Generates a backend JWT
 *   3. Forwards the request to the Express backend with Authorization header
 *
 * The client-side never handles JWTs directly.
 */

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, ...rest } = options;
    // Strip leading /api if present (e.g. /api/bookings → bookings)
    const cleanPath = path.startsWith('/api') ? path.slice(5) : path.replace(/^\//, '');

    const res = await fetch(`/api/bff/${cleanPath}`, {
        ...rest,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...rest.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw Object.assign(new Error(error.message ?? 'Request failed'), {
            status: res.status,
            code:   error.error,
        });
    }

    return res.json() as Promise<T>;
}

export const http = {
    get:    <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'GET' }),
    post:   <T>(path: string, body?: unknown, init?: RequestOptions) => request<T>(path, { ...init, method: 'POST', body }),
    put:    <T>(path: string, body?: unknown, init?: RequestOptions) => request<T>(path, { ...init, method: 'PUT', body }),
    patch:  <T>(path: string, body?: unknown, init?: RequestOptions) => request<T>(path, { ...init, method: 'PATCH', body }),
    delete: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'DELETE' }),
};