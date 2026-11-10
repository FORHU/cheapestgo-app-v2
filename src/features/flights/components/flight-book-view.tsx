'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { CheckoutSkeleton } from '@/features/checkout/components/checkout-skeleton';

/**
 * `/flights/book`: hands a chosen flight over to checkout, kept for links that still point here
 * (the results page now goes straight to checkout). It draws the checkout's skeleton while it
 * does — it drew nothing, and the layout's footer was then all a phone showed.
 */
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

    return <CheckoutSkeleton />;
}

export function FlightBookView() {
    return (
        <Suspense fallback={<CheckoutSkeleton />}>
            <Redirect />
        </Suspense>
    );
}
