'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

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
