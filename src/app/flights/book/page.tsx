'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Redirect() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        const offerId = params.get('offerId');
        if (offerId) {
            // Forward all query params to the unified checkout page
            const qs = new URLSearchParams(params.toString());
            router.replace(`/checkout?${qs.toString()}`);
        } else {
            router.replace('/');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}

export default function FlightBookPage() {
    return (
        <Suspense>
            <Redirect />
        </Suspense>
    );
}
