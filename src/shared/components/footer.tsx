"use client";

import React, { Suspense } from 'react';
import { usePathname } from '@/i18n/navigation';
import { LandingFooter } from '@/features/landing/components/landing-footer';

const FooterContent = () => {
    const pathname = usePathname();
    if (pathname === '/') return null;
    return <LandingFooter />;
};

export function Footer() {
    return (
        <Suspense fallback={null}>
            <FooterContent />
        </Suspense>
    );
}
