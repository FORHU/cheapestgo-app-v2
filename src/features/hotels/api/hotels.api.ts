import type { PropertyApiResponse, PropertySearchParams } from '@/features/hotels/types/property.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v2';

/**
 * Server-side fetch for property detail.
 * Called from the Server Component page — never bundled into client JS.
 */
export async function fetchProperty(
    id: string,
    params: PropertySearchParams = {},
): Promise<PropertyApiResponse> {
    const qs = new URLSearchParams();
    if (params.checkIn)   qs.set('checkIn',   params.checkIn);
    if (params.checkOut)  qs.set('checkOut',  params.checkOut);
    if (params.adults)    qs.set('adults',    params.adults);
    if (params.children)  qs.set('children',  params.children);

    const url = `${API_BASE}/hotels/property/${encodeURIComponent(id)}?${qs}`;

    const res = await fetch(url, {
        cache:  'no-store',
        signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
        if (res.status === 404) return { error: 'Property not found.' };
        return { error: `Failed to load property (${res.status}).` };
    }

    return res.json() as Promise<PropertyApiResponse>;
}
