import { cache } from 'react';
import { type Deal } from '@/types';

export const getFlightDeals = cache(async (): Promise<Deal[]> => {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) return [];
        const res = await fetch(`${apiUrl}/landing/deals`, {
            next: { revalidate: 300 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.deals ?? data ?? [];
    } catch {
        return [];
    }
});
