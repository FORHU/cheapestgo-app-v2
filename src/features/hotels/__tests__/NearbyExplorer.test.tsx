import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';

const nearby = vi.hoisted(() => ({
    value: { gems: [] as NearbyGem[], loading: false, error: false, retry: () => {} },
}));

vi.mock('@/features/hotels/components/nearby/NearbyMap', () => ({
    NearbyMap: ({ children, places, onSelect }: { children?: React.ReactNode; places: NearbyGem[]; onSelect: (g: NearbyGem) => void }) => (
        <div data-testid="map">
            {places.map((p) => <button key={p.id} type="button" onClick={() => onSelect(p)}>pin {p.name}</button>)}
            {children}
        </div>
    ),
}));
vi.mock('@/features/hotels/hooks/useNearbyGems', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/hotels/hooks/useNearbyGems')>()),
    useNearbyGems: vi.fn(() => nearby.value),
}));

import { NearbyExplorer } from '@/features/hotels/components/nearby/NearbyExplorer';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import { useSearchStore } from '@/shared/stores/search.store';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

beforeEach(() => {
    localStorage.clear();
    useSearchStore.setState({ distanceUnit: 'km' });
    nearby.value = { gems: [gem()], loading: false, error: false, retry: () => {} };
    vi.mocked(useNearbyGems).mockClear();
});

const explorer = () => renderWithIntl(<NearbyExplorer coordinates={HOTEL} hotelName="Hotel Onion" palette={PALETTE} />);

describe('NearbyExplorer', () => {
    it('opens a place’s details from its card', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Details: Cafe Onion' }));
        expect(screen.getByRole('dialog', { name: 'Cafe Onion' })).toBeInTheDocument();
    });

    it('switching to miles re-snaps the radius and remembers the choice', () => {
        explorer();
        expect(useNearbyGems).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 2000 }));

        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));

        expect(useNearbyGems).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 1609 }));
        expect(useSearchStore.getState().distanceUnit).toBe('mi');
    });

    it('starts on the miles radius when the viewer already prefers miles (no re-snap, no 2000 fetch)', () => {
        useSearchStore.setState({ distanceUnit: 'mi' });
        explorer();
        expect(vi.mocked(useNearbyGems).mock.calls.length).toBeGreaterThan(0);
        expect(vi.mocked(useNearbyGems).mock.calls.every(([a]) => a.radiusMeters === 1609)).toBe(true);
    });

    it('changing category clears the selected place', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Cafe Onion' }));
        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Place type/ }));
        fireEvent.click(screen.getByRole('option', { name: 'Transit' }));

        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toHaveAttribute('aria-pressed', 'false');
    });
});
