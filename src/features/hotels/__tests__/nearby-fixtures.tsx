import React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Search } from 'lucide-react';
import enMessages from '@/locales/en.json';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import type { NearbyPalette } from '@/features/hotels/components/nearby/types';

export const HOTEL = { lat: 37.55, lng: 126.98 };

/** 356 m due north of HOTEL: "360 m" in km, "0.2 mi" in miles. */
export const NEAR = { lat: 37.5532, lng: 126.98 };

export const PALETTE: NearbyPalette = {
    bg: '#ffffff', title: '#0f172a', text: '#334155', muted: '#64748b', soft: '#475569',
    hairline: '#e2e8f0', cardBg: 'rgba(0,0,0,.03)', cardBorder: 'rgba(0,0,0,.08)',
    iconBg: 'rgba(0,0,0,.04)', mapStyle: 'mapbox://styles/mapbox/streets-v12',
};

export function gem(overrides: Partial<NearbyGem> = {}): NearbyGem {
    return {
        id: 'g-1',
        placeId: 'g-1',
        name: 'Cafe Onion',
        category: 'cafe',
        rating: 4.6,
        imageUrl: 'http://api.test/api/v2/photos/poi?name=Cafe+Onion',
        icon: Search,
        coordinates: NEAR,
        isStub: false,
        ...overrides,
    };
}

export function renderWithIntl(ui: React.ReactElement) {
    return render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>{ui}</NextIntlClientProvider>,
    );
}
