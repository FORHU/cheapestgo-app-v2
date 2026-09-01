import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoomSelection } from '@/features/hotels/components/room-selection';
import type { RoomOption, RoomContent } from '@/features/hotels/types/property.types';

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

describe('RoomSelection — categorised modal', () => {
    const content: RoomContent = {
        gallery: [],
        keyFacts: [{ label: 'Non-smoking' }, { label: 'Private bathroom' }],
        bedLine: 'Double bed',
        bedsExtraSummary: 'Extra beds and cribs are unavailable for this room type',
        sections: [
            { id: 'bathroom', title: 'Bathroom', scope: 'room', items: [{ label: 'Shower' }] },
            { id: 'media-tech', title: 'Media and technology', scope: 'room', items: [{ label: 'Cable channels' }] },
        ],
    };

    it('renders per-category headers, key facts and the bed / cribs lines', () => {
        const room = makeRoom();
        room.content = content;
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Bathroom')).toBeInTheDocument();
        expect(within(dialog).getByText('Media and technology')).toBeInTheDocument();
        expect(within(dialog).getByText('Shower')).toBeInTheDocument();
        expect(within(dialog).getByText('Double bed')).toBeInTheDocument();
        expect(within(dialog).getByText('Non-smoking')).toBeInTheDocument();
        expect(within(dialog).getByText('Extra beds and cribs are unavailable for this room type')).toBeInTheDocument();
    });

    it('appends property-scoped sections and the additional-info block', () => {
        const room = makeRoom();
        room.content = content;
        render(
            <RoomSelection
                {...baseProps}
                rooms={[room]}
                propertySections={[
                    { id: 'child-policy', title: 'Child policies', scope: 'property', items: [{ label: 'Children 0–5 stay free' }] },
                ]}
                additionalInfo={'Photo ID required at check-in.'}
            />,
        );
        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Child policies')).toBeInTheDocument();
        expect(within(dialog).getByText('Children 0–5 stay free')).toBeInTheDocument();
        expect(within(dialog).getByText('Additional information')).toBeInTheDocument();
        expect(within(dialog).getByText('Photo ID required at check-in.')).toBeInTheDocument();
    });

    it('falls back to the legacy amenity list when content is absent', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom({ amenities: ['Sea view', 'Balcony'] })]} hotelAmenities={[]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Sea view')).toBeInTheDocument();
        expect(within(dialog).queryByText('Bathroom')).not.toBeInTheDocument();
    });

    it('falls back to the legacy list when content is present but the room did not match', () => {
        const room = makeRoom({ amenities: ['Sea view'] });
        // hollow content — the shape the API attaches when matchEtgRoomGroup misses
        room.content = {
            gallery: [], keyFacts: [], sections: [],
            bedLine: 'Double bed',
            bedsExtraSummary: 'Extra beds and cribs are unavailable for this room type',
        };
        render(<RoomSelection {...baseProps} rooms={[room]} hotelAmenities={[]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
        const dialog = screen.getByRole('dialog');
        // legacy amenity list is back…
        expect(within(dialog).getByText('Sea view')).toBeInTheDocument();
        expect(within(dialog).getByText('Room')).toBeInTheDocument();
        // …but the name-derived bed line and metapolicy cribs line still show.
        expect(within(dialog).getByText('Double bed')).toBeInTheDocument();
        expect(within(dialog).getByText('Extra beds and cribs are unavailable for this room type')).toBeInTheDocument();
    });

    it('opens the photo viewer from a thumbnail without closing the modal', () => {
        const room = makeRoom();
        room.content = { ...content, gallery: ['/a.jpg', '/b.jpg'] };
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[0]);
        const dialog = screen.getByRole('dialog');

        fireEvent.click(dialog.querySelectorAll('img')[0]);
        // Viewer counter appears…
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        // …and the room-detail modal is still mounted behind it.
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Dismissing the viewer (Escape) must not also close the modal.
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
