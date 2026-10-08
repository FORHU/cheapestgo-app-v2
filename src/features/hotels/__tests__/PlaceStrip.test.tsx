import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PoiCategory } from '@/shared/config/map-discovery';
import type { DistanceUnit } from '@/shared/lib/distance';
import { PlaceStrip } from '@/features/hotels/components/nearby/PlaceStrip';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

function props(overrides: Partial<React.ComponentProps<typeof PlaceStrip>> = {}) {
    return {
        gems: [gem()],
        loading: false,
        error: false,
        onRetry: vi.fn(),
        category: 'all' as PoiCategory,
        onCategoryChange: vi.fn(),
        radius: 2000,
        onRadiusChange: vi.fn(),
        unit: 'km' as DistanceUnit,
        onUnitChange: vi.fn(),
        hotel: HOTEL,
        activeId: null,
        onSelect: vi.fn(),
        onDetails: vi.fn(),
        palette: PALETTE,
        ...overrides,
    };
}

const radiusLabels = () =>
    screen.getAllByRole('radio').filter((r) => r.closest('[aria-label="Search radius"]')).map((r) => r.textContent);

describe('PlaceStrip', () => {
    it('shows each place with its distance in kilometres', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        expect(screen.getByText('Cafe Onion')).toBeInTheDocument();
        expect(screen.getByText('360 m')).toBeInTheDocument();
    });

    it('shows distances and radius steps in miles', () => {
        renderWithIntl(<PlaceStrip {...props({ unit: 'mi', radius: 1609 })} />);
        expect(screen.getByText('0.2 mi')).toBeInTheDocument();
        expect(radiusLabels()).toEqual(['0.5 mi', '1 mi', '3 mi', '5 mi']);
    });

    it('offers round radius steps in kilometres and marks the current one', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        expect(radiusLabels()).toEqual(['1 km', '2 km', '5 km', '10 km']);
        expect(screen.getByRole('radio', { name: '2 km' })).toHaveAttribute('aria-checked', 'true');
    });

    it('reports a radius pick in metres', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: '5 km' }));
        expect(p.onRadiusChange).toHaveBeenCalledWith(5000);
    });

    it('reports a unit switch', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));
        expect(p.onUnitChange).toHaveBeenCalledWith('mi');
    });

    it('picks a category from the dropdown', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('button', { name: 'Place type' }));
        fireEvent.click(screen.getByRole('option', { name: 'Dining' }));
        expect(p.onCategoryChange).toHaveBeenCalledWith('restaurant');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('selects a place, or opens its details, from its card', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cafe Onion' }));
        expect(p.onSelect).toHaveBeenCalledWith(p.gems[0]);

        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(p.onDetails).toHaveBeenCalledWith(p.gems[0]);
        expect(p.onSelect).toHaveBeenCalledTimes(1);
    });

    it('shows placeholders while loading', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [], loading: true })} />);
        expect(screen.getAllByTestId('place-skeleton')).toHaveLength(8);
    });

    it('says the lookup failed — not that nothing is nearby — and offers a retry', () => {
        const p = props({ gems: [], error: true });
        renderWithIntl(<PlaceStrip {...p} />);

        expect(screen.getByText("Couldn't load nearby places.")).toBeInTheDocument();
        expect(screen.queryByText('No places found nearby.')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(p.onRetry).toHaveBeenCalled();
    });

    it('keeps the cards and flags an incomplete lookup when some places came back', () => {
        const p = props({ error: true });
        renderWithIntl(<PlaceStrip {...p} />);

        expect(screen.getByText('Cafe Onion')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent("Couldn't load nearby places.");

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(p.onRetry).toHaveBeenCalled();
    });

    it('says when there is genuinely nothing nearby', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [] })} />);
        expect(screen.getByText('No places found nearby.')).toBeInTheDocument();
    });
});
