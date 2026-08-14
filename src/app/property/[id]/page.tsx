import React, { Suspense } from 'react';
import { PropertyView } from '@/features/hotels/components/property-view';
import { HOTEL_TOKENS } from '@/features/hotels/types/property.types';

function LoadingFallback() {
    return (
        <div style={{ minHeight: '100vh', background: HOTEL_TOKENS.BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
                <circle cx="12" cy="12" r="9" fill="none" stroke={HOTEL_TOKENS.ACCENT} strokeWidth="3" strokeDasharray="16 100" strokeLinecap="round" />
            </svg>
        </div>
    );
}

export default function HotelPropertyPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <PropertyView />
        </Suspense>
    );
}
