import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PoiCategory } from '@/shared/config/map-discovery';
import type { DistanceUnit } from '@/shared/lib/distance';
import { PlaceCards, PlaceFilters, type PlaceStripProps } from '@/features/hotels/components/nearby/PlaceStrip';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

/** The strip as the explorer lays it out: the filters, then the cards (which the page draws over the map). */
function PlaceStrip(p: PlaceStripProps) {
    return <><PlaceFilters {...p} /><PlaceCards {...p} /></>;
}

function props(overrides: Partial<PlaceStripProps> = {}): PlaceStripProps {
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

    it('marks the rating as a star and score in line with the distance, read out of 5', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        const rating = screen.getByRole('img', { name: '4.6 out of 5 stars' });
        expect(rating).toHaveTextContent('4.6');
        expect(rating.parentElement).toHaveTextContent('360 m');
    });

    it('leaves the rating off a place that has none', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [gem({ rating: null })] })} />);
        expect(screen.queryByRole('img', { name: /out of 5 stars/ })).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', { name: /Place type/ }));
        fireEvent.click(screen.getByRole('option', { name: 'Dining' }));
        expect(p.onCategoryChange).toHaveBeenCalledWith('restaurant');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('selects a place, or opens its details, from its card', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cafe Onion' }));
        expect(p.onSelect).toHaveBeenCalledWith(p.gems[0]);

        fireEvent.click(screen.getByRole('button', { name: 'Details: Cafe Onion' }));
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

    it('names the category trigger with its current value', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        expect(screen.getByRole('button', { name: 'Place type: All' })).toBeInTheDocument();
    });

    it('closes the dropdown on Escape and returns focus to the trigger', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        const trigger = screen.getByRole('button', { name: /Place type/ });
        fireEvent.click(trigger);
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('closes the dropdown when clicking outside it', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        fireEvent.click(screen.getByRole('button', { name: /Place type/ }));
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('returns focus to the trigger after picking an option', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        const trigger = screen.getByRole('button', { name: /Place type/ });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('option', { name: 'Dining' }));
        expect(trigger).toHaveFocus();
    });

    it('moves the radius with the arrow keys, one roving tab stop', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        expect(screen.getByRole('radio', { name: '2 km' })).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: '1 km' })).toHaveAttribute('tabindex', '-1');

        fireEvent.keyDown(screen.getByRole('radio', { name: '2 km' }), { key: 'ArrowRight' });
        expect(p.onRadiusChange).toHaveBeenLastCalledWith(5000);
        expect(screen.getByRole('radio', { name: '5 km' })).toHaveFocus();

        fireEvent.keyDown(screen.getByRole('radio', { name: '2 km' }), { key: 'ArrowLeft' });
        expect(p.onRadiusChange).toHaveBeenLastCalledWith(1000);

        vi.mocked(p.onRadiusChange).mockClear();
        fireEvent.keyDown(screen.getByRole('radio', { name: '10 km' }), { key: 'ArrowDown' });
        expect(p.onRadiusChange).not.toHaveBeenCalled();
    });

    it('makes the first radius step tabbable when none is current', () => {
        renderWithIntl(<PlaceStrip {...props({ radius: 3000 })} />);
        expect(screen.getByRole('radio', { name: '1 km' })).toHaveAttribute('tabindex', '0');
    });

    it('names the select button after the visible, translated name', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [gem({ name: '카페 어니언', translatedName: 'Cafe Onion' })] })} />);
        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Details: Cafe Onion' })).toBeInTheDocument();
    });

    it('marks the active place as pressed', () => {
        renderWithIntl(<PlaceStrip {...props({ activeId: 'g-1' })} />);
        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('draws a focus ring on the card, since the button outline would be clipped', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        const card = screen.getByRole('button', { name: 'Cafe Onion' }).parentElement!;
        expect(card.className).toMatch(/has-\[button\[data-select\]:focus-visible\]:outline-2/);
    });
});
