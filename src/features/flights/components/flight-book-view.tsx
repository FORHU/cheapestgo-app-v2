'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Redirect() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        const offerId = params.get('offerId');
        if (offerId) {
            const qs = new URLSearchParams(params.toString());
            router.replace(`/checkout?${qs.toString()}`);
        } else {
            router.replace('/');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}

export function FlightBookView() {
    return (
        <Suspense>
            <Redirect />
        </Suspense>
    );
}
