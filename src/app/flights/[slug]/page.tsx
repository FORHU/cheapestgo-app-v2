'use client';

import { useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

function Redirect() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();

    useEffect(() => {
        const match = slug?.match(/^([A-Z]{3})-([A-Z]{3})$/i);
        if (match) {
            router.replace(`/flights/search?origin=${match[1].toUpperCase()}&destination=${match[2].toUpperCase()}`);
        } else {
            router.replace('/flights/search');
        }
    }, [slug, router]);

    return null;
}

export default function FlightSlugPage() {
    return <Suspense><Redirect /></Suspense>;
}
