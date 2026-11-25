// src/features/golf-api-demo/api/mockHttp.ts
/**
 * A request helper for the Golf Mock API — `api-v2`'s `/api/v1/golf`, not `/api/v2`, so it is not
 * the shared `@/shared/lib/http` (which is hardwired to that production prefix). Kept small and
 * local rather than generalising `http.ts`: this module should stay easy to delete whole.
 */
import { env } from '@/shared/lib/env';

/**
 * `NEXT_PUBLIC_API_URL` names the production API's own base, ending in `/api/v2` (or, on the
 * staff host, rewritten by `apiBaseForHost` to just the pathname `/api/v2`). The mock API is a
 * sibling path on the same backend, so swap the version segment rather than appending to it.
 */
function mockApiBase(): string {
    return env.NEXT_PUBLIC_API_URL.replace(/\/api\/v2\/?$/, '') + '/api/v1/golf';
}

export interface MockApiError extends Error {
    status: number;
    code?:  string;
    body:   unknown;
}

type RequestOptions = { body?: unknown };

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    const url = `${mockApiBase()}${path}`;
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw Object.assign(new Error(body.message ?? res.statusText), {
            status: res.status, code: body.error, body,
        }) as MockApiError;
    }
    return { data: (body.data ?? body) as T, status: res.status };
}

export const mockHttp = {
    get:  <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
    put:  <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
};
