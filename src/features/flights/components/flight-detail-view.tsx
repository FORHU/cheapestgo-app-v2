'use client';

import { useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { resolveDepartureDate } from '@/features/landing/lib/links';

function Redirect() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();

    useEffect(() => {
        const match = slug?.match(/^([A-Z]{3})-([A-Z]{3})$/i);
        if (match) {
            // With a date. This route is a page *about* a route, so it never had one to
            // pass on — and the search page answers a dateless search with "Missing search
            // parameters". Every `/flights/XXX-YYY` link dead-ended on that screen.
            const { departure } = resolveDepartureDate(null);
            router.replace(
                `/flights/search?origin=${match[1].toUpperCase()}&destination=${match[2].toUpperCase()}&depart=${departure}`,
            );
        } else {
            router.replace('/flights/search');
        }
    }, [slug, router]);

    return null;
}

export function FlightDetailView() {
    return <Suspense><Redirect /></Suspense>;
}
