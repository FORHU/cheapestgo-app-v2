import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoomSelection } from '@/features/hotels/components/room-selection';
import type { RoomOption } from '@/features/hotels/types/property.types';

// The card reads the app theme; pin it so the palette is deterministic.
vi.mock('@/shared/components/ThemeContext', () => ({
    useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

// Return the amount untouched so price assertions are predictable.
vi.mock('@/shared/lib/currency', () => ({
    convertCurrency: (amount: number) => amount,
}));

const makeRoom = (overrides: Partial<RoomOption> = {}): RoomOption => ({
    id:       'room-1',
    name:     'Comfort Leisure Room (1 double bed)',
    price:    200,
    currency: 'USD',
    rates: [{
        offerId:              'offer-1',
        price:                200,
        currency:             'USD',
        boardCode:            'RO',
        refundable:           true,
        refundableTag:        'REFUNDABLE',
        cancellationDeadline: '2026-09-09T00:00:00Z',
    }],
    ...overrides,
});

const baseProps = {
    currency:        'USD',
    nights:          1,
    checkIn:         '2026-09-10',
    occupancy:       { adults: 2, children: 0 },
    selectedOfferId: null,
    onSelect:        vi.fn(),
    tone:            'dark' as const,
};

describe('RoomSelection', () => {
    it('renders the section heading and the filter row', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.getByText('Available Rooms')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Breakfast Included' })).toBeInTheDocument();
    });

    it('draws the room name and per-night price', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.getByText('Comfort Leisure Room')).toBeInTheDocument();
        expect(screen.getByText('$200')).toBeInTheDocument();
        expect(screen.getByText('/night')).toBeInTheDocument();
    });

    it('shows a short board pill and a refundable pill', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.getByText('Room Only')).toBeInTheDocument();
        // "Refundable" is also a filter button — the pill is the <span>.
        const pill = screen.getAllByText('Refundable').filter(el => el.tagName === 'SPAN');
        expect(pill).toHaveLength(1);
    });

    it('shows "Non-refundable" when the rate is not refundable', () => {
        const room = makeRoom({
            rates: [{
                offerId: 'o', price: 200, currency: 'USD', boardCode: 'RO',
                refundable: false, refundableTag: 'NON_REFUNDABLE',
            }],
        });
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        const pill = screen.getAllByText('Non-refundable').filter(el => el.tagName === 'SPAN');
        expect(pill).toHaveLength(1);
    });

    it('lists the bed and the searched party under Room Details', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} occupancy={{ adults: 2, children: 1 }} />);
        expect(screen.getByText('Room Details')).toBeInTheDocument();
        expect(screen.getByText('1 double bed')).toBeInTheDocument();
        expect(screen.getByText('2 Adults · 1 Child')).toBeInTheDocument();
    });

    it('omits the size row when the room carries no size', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.queryByText(/sqm$/)).not.toBeInTheDocument();
    });

    it('words free cancellation as hours before check-in', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.getByText('Payment Terms')).toBeInTheDocument();
        expect(screen.getByText('24-hour free cancellation')).toBeInTheDocument();
    });

    it('hides the Payment Terms column for a non-refundable rate', () => {
        const room = makeRoom({
            rates: [{
                offerId: 'o', price: 200, currency: 'USD', boardCode: 'RO',
                refundable: false, refundableTag: 'NON_REFUNDABLE',
            }],
        });
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        expect(screen.queryByText('Payment Terms')).not.toBeInTheDocument();
    });

    it('opens the detail modal from "View more" and can select the room from it', () => {
        const onSelect = vi.fn();
        // rate.price is the whole-stay figure; over 3 nights that is $200/night.
        const room = makeRoom({ price: 600, rates: [{ ...makeRoom().rates![0], price: 600 }] });
        render(<RoomSelection {...baseProps} rooms={[room]} nights={3} onSelect={onSelect} />);

        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('$200 / night × 3 nights')).toBeInTheDocument();
        expect(within(dialog).getByText('Total $600')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Select Room' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            rate: expect.objectContaining({ offerId: 'offer-1' }),
        }));
    });

    it('fires onSelect when the card button is clicked', () => {
        const onSelect = vi.fn();
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: 'Select Room' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            room:  expect.objectContaining({ id: 'room-1' }),
            rate:  expect.objectContaining({ offerId: 'offer-1' }),
        }));
    });

    it('renders one card per rate', () => {
        const room = makeRoom({
            rates: [
                { offerId: 'a', price: 200, currency: 'USD', boardCode: 'RO', refundable: true,  refundableTag: 'REFUNDABLE' },
                { offerId: 'b', price: 240, currency: 'USD', boardCode: 'BB', refundable: false, refundableTag: 'NON_REFUNDABLE' },
            ],
        });
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        expect(screen.getAllByRole('button', { name: /Select Room|Selected/ })).toHaveLength(2);
        expect(screen.getByText('$200')).toBeInTheDocument();
        expect(screen.getByText('$240')).toBeInTheDocument();
    });
});
