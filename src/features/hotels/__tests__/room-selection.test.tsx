import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithIntl as render } from '@/shared/testing/renderWithIntl';
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

    it('bullets the bed, the searched party and the board under the name', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} occupancy={{ adults: 2, children: 1 }} />);
        expect(screen.getAllByRole('listitem').map(li => li.textContent))
            .toEqual(['1 double bed', '2 Adults · 1 Child', 'Room Only']);
    });

    it('omits the size row when the room carries no size', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.queryByText(/sqm$/)).not.toBeInTheDocument();
    });

    it('words free cancellation as hours before check-in', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.getByText('Free cancellation up to 24h before check-in')).toBeInTheDocument();
    });

    it('says "Non-refundable" in place of the cancellation line when the rate is not refundable', () => {
        const room = makeRoom({
            rates: [{
                offerId: 'o', price: 200, currency: 'USD', boardCode: 'RO',
                refundable: false, refundableTag: 'NON_REFUNDABLE',
            }],
        });
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        // "Non-refundable" is also a filter button — the row's line is the <p>.
        const line = screen.getAllByText('Non-refundable').filter(el => el.tagName === 'P');
        expect(line).toHaveLength(1);
        expect(screen.queryByText(/Free cancellation/)).not.toBeInTheDocument();
    });

    it('opens the detail modal from "Room details" and can select the room from it', () => {
        const onSelect = vi.fn();
        // rate.price arrives per night — api-v2 divides the supplier's stay total before
        // sending, as v1 does — so the modal multiplies back up for the total line rather
        // than dividing down for the rate.
        const room = makeRoom({ price: 200, rates: [{ ...makeRoom().rates![0], price: 200 }] });
        render(<RoomSelection {...baseProps} rooms={[room]} nights={3} onSelect={onSelect} />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);

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
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            room:  expect.objectContaining({ id: 'room-1' }),
            rate:  expect.objectContaining({ offerId: 'offer-1' }),
        }));
    });

    it('renders a whole card for each rate', () => {
        const room = makeRoom({
            rates: [
                { offerId: 'a', price: 200, currency: 'USD', boardCode: 'RO', refundable: true,  refundableTag: 'REFUNDABLE' },
                { offerId: 'b', price: 240, currency: 'USD', boardCode: 'BB', refundable: false, refundableTag: 'NON_REFUNDABLE' },
            ],
        });
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        // A whole card per rate, each naming the room and carrying its own Select.
        expect(screen.getAllByRole('article')).toHaveLength(2);
        expect(screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent))
            .toEqual(['Comfort Leisure Room', 'Comfort Leisure Room']);
        expect(screen.getAllByRole('button', { name: /^(Select|Selected)$/ })).toHaveLength(2);
        expect(screen.getByText('$200')).toBeInTheDocument();
        expect(screen.getByText('$240')).toBeInTheDocument();
    });
});

describe('RoomSelection — categorised modal', () => {
    const content: RoomContent = {        keyFacts: [{ label: 'Non-smoking' }, { label: 'Private bathroom' }],
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
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
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
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Child policies')).toBeInTheDocument();
        expect(within(dialog).getByText('Children 0–5 stay free')).toBeInTheDocument();
        expect(within(dialog).getByText('Additional information')).toBeInTheDocument();
        expect(within(dialog).getByText('Photo ID required at check-in.')).toBeInTheDocument();
    });

    it('falls back to the legacy amenity list when content is absent', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom({ amenities: ['Sea view', 'Balcony'] })]} hotelAmenities={[]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Sea view')).toBeInTheDocument();
        expect(within(dialog).queryByText('Bathroom')).not.toBeInTheDocument();
    });

    it('falls back to the legacy list when content is present but the room did not match', () => {
        const room = makeRoom({ amenities: ['Sea view'] });
        // hollow content — the shape the API attaches when matchEtgRoomGroup misses
        room.content = {
            keyFacts: [], sections: [],
            bedLine: 'Double bed',
            bedsExtraSummary: 'Extra beds and cribs are unavailable for this room type',
        };
        render(<RoomSelection {...baseProps} rooms={[room]} hotelAmenities={[]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
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
        room.roomPhotos = ['/a.jpg', '/b.jpg'];
        room.content = content;
        render(<RoomSelection {...baseProps} rooms={[room]} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
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

/**
 * A room shows its own photograph.
 *
 * The API sends `roomPhotos`. This component read `content.gallery`, and the type declared
 * a third name, `roomImages` — so every card fell through to the hotel's exterior shot even
 * where eight pictures of the room had arrived. Every room on a property looked identical,
 * which on a page someone books from is the one thing that must not happen.
 *
 * `content` is deliberately absent in both tests below: photographs do not depend on ETG
 * having also matched key facts or sections, and tying them together is how the old code
 * hid this.
 */
describe('RoomSelection — room photography', () => {
    const HOTEL_SHOT = '/hotel-exterior.jpg';

    it('prefers the room’s own photo over the hotel’s on the card', () => {
        const room = makeRoom({ roomPhotos: ['/room-a.jpg', '/room-b.jpg'] });
        render(<RoomSelection {...baseProps} rooms={[room]} image={HOTEL_SHOT} />);

        const sources = Array.from(document.querySelectorAll('img')).map(img => img.getAttribute('src'));
        expect(sources).toContain('/room-a.jpg');
        expect(sources).not.toContain(HOTEL_SHOT);
    });

    it('reads the room’s photos from content.gallery, where current api-v2 sends them', () => {
        const room = makeRoom({ content: { gallery: ['/gallery-a.jpg', '/gallery-b.jpg'], keyFacts: [], sections: [] } });
        render(<RoomSelection {...baseProps} rooms={[room]} image={HOTEL_SHOT} />);

        const sources = Array.from(document.querySelectorAll('img')).map(img => img.getAttribute('src'));
        expect(sources).toContain('/gallery-a.jpg');
        expect(sources).not.toContain(HOTEL_SHOT);
    });

    it('leads every card with its gallery’s first photo, even where two rooms share a gallery', () => {
        // Two supplier names for one ETG room group: the same pictures, in the same order. Only
        // the first is reliably the room — ETG galleries go on to the building and the
        // toiletries — so the second card does not reach past it to look different.
        const gallery = ['/twin-room.jpg', '/building.jpg', '/toiletries.jpg'];
        const rooms = [
            makeRoom({ id: 'a', name: 'Standard Twin room (twin beds)', price: 100, rates: [{ ...makeRoom().rates![0], offerId: 'a', price: 100 }], content: { gallery, keyFacts: [], sections: [] } }),
            makeRoom({ id: 'b', name: 'Standard Twin room (twin beds) (non-smoking)', price: 120, rates: [{ ...makeRoom().rates![0], offerId: 'b', price: 120 }], content: { gallery, keyFacts: [], sections: [] } }),
        ];
        render(<RoomSelection {...baseProps} rooms={rooms} image={HOTEL_SHOT} />);

        const leads = screen.getAllByRole('article').map(card => card.querySelector('img')?.getAttribute('src'));
        expect(leads).toEqual(['/twin-room.jpg', '/twin-room.jpg']);
    });

    it('shows every room photo in the detail panel, with no ETG content alongside', () => {
        const room = makeRoom({ roomPhotos: ['/room-a.jpg', '/room-b.jpg'] });
        render(<RoomSelection {...baseProps} rooms={[room]} image={HOTEL_SHOT} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);

        const dialog = screen.getByRole('dialog');
        const sources = Array.from(dialog.querySelectorAll('img')).map(img => img.getAttribute('src'));
        expect(sources).toEqual(expect.arrayContaining(['/room-a.jpg', '/room-b.jpg']));
    });

    it('falls back to the hotel’s photo, and says so, when the room has none', () => {
        const room = makeRoom({ roomPhotos: [] });
        render(<RoomSelection {...baseProps} rooms={[room]} image={HOTEL_SHOT} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);

        const dialog = screen.getByRole('dialog');
        const sources = Array.from(dialog.querySelectorAll('img')).map(img => img.getAttribute('src'));
        expect(sources).toContain(HOTEL_SHOT);
        // Labelled, so the hotel's building is never passed off as the room.
        expect(within(dialog).getByText('Photo of the property')).toBeInTheDocument();
    });
});
