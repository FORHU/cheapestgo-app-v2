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

        // The footer prices the night, as the card does, and states the stay under it.
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('$200')).toBeInTheDocument();
        expect(within(dialog).getByText('/night')).toBeInTheDocument();
        expect(within(dialog).getByText('Total $600 · 3 nights')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Select room' }));
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

    /**
     * One room is one card however many ways it is sold. Drawn per rate, "Standard Family
     * room" appeared twice over at ₱5,409 and ₱5,506 — identical but for the price, which
     * reads as a listing fault rather than as a choice of terms.
     */
    const twoRateRoom = () => makeRoom({
        rates: [
            { offerId: 'a', price: 200, currency: 'USD', boardCode: 'RO', refundable: true,  refundableTag: 'REFUNDABLE' },
            { offerId: 'b', price: 240, currency: 'USD', boardCode: 'BB', refundable: false, refundableTag: 'NON_REFUNDABLE' },
        ],
    });

    it('draws one card for a room sold at several rates', () => {
        render(<RoomSelection {...baseProps} rooms={[twoRateRoom()]} />);
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent))
            .toEqual(['Comfort Leisure Room']);
        // One Select — it books whichever rate is showing.
        expect(screen.getAllByRole('button', { name: /^(Select|Selected)$/ })).toHaveLength(1);
    });

    it('offers every rate as a chip, cheapest showing first', () => {
        render(<RoomSelection {...baseProps} rooms={[twoRateRoom()]} />);
        const chips = within(screen.getByRole('radiogroup')).getAllByRole('radio');
        expect(chips.map(c => c.textContent))
            .toEqual(['$200 · Room Only · free cancellation', '$240 · Breakfast Included · non-refundable']);
        expect(chips[0]).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText('$200')).toBeInTheDocument();
    });

    it('re-reads the card from the chip that is picked', () => {
        render(<RoomSelection {...baseProps} rooms={[twoRateRoom()]} />);
        fireEvent.click(within(screen.getByRole('radiogroup')).getAllByRole('radio')[1]);
        expect(screen.getByText('$240')).toBeInTheDocument();
        expect(screen.queryByText('$200')).not.toBeInTheDocument();
    });

    it('books the picked rate, not the cheapest', () => {
        const onSelect = vi.fn();
        render(<RoomSelection {...baseProps} rooms={[twoRateRoom()]} onSelect={onSelect} />);
        fireEvent.click(within(screen.getByRole('radiogroup')).getAllByRole('radio')[1]);
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            rate: expect.objectContaining({ offerId: 'b' }),
        }));
    });

    it('shows no chip row for a room sold one way', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom()]} />);
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    const rate = (o: Record<string, unknown>) => ({
        offerId: 'offer-x',
        price: 200, currency: 'USD', boardCode: 'RO',
        refundable: true, refundableTag: 'REFUNDABLE',
        cancellationDeadline: '2026-09-09T00:00:00Z', ...o,
    });

    /**
     * ADR-0007. TGX hangs variant text in parentheses and sends more than one, so one room
     * arrived as two cards — same photograph, same beds — differing only in whether
     * "(twin beds)" had survived into the title. Reported as a rendering fault on 2026-11-04.
     */
    it('draws one card when two rooms differ only by the bed-guarantee qualifier', () => {
        render(<RoomSelection {...baseProps} rooms={[
            makeRoom({ id: 'r1', name: 'Deluxe Twin room (twin beds) (bed type is subject to availability)',
                       rates: [rate({ offerId: 'a', price: 200 })] }),
            makeRoom({ id: 'r2', name: 'Deluxe Twin room (twin beds)',
                       rates: [rate({ offerId: 'b', price: 240, cancellationDeadline: '2026-09-11T00:00:00Z' })] }),
        ]} />);
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent))
            .toEqual(['Deluxe Twin room']);
    });

    /**
     * One heading covers several rooms where the supplier separates them only in the
     * parenthetical — ROYAL Hotel Seoul files "no window" under the same "Standard room" as
     * a normal one. They share a card, so the chip must name what each is; unnamed, a reader
     * picks on price and gets the other.
     */
    it('names the room difference on the chip when one heading covers several', () => {
        render(<RoomSelection {...baseProps} rooms={[
            makeRoom({ id: 'r1', name: 'Standard Double room (shared bathroom)',
                       rates: [rate({ offerId: 'a' })] }),
            makeRoom({ id: 'r2', name: 'Standard Double room (full double bed)',
                       rates: [rate({ offerId: 'b', price: 240 })] }),
        ]} />);
        expect(screen.getAllByRole('article')).toHaveLength(1);
        const chips = within(screen.getByRole('radiogroup')).getAllByRole('radio');
        expect(chips.map(c => c.textContent))
            .toEqual(['$200 · shared bathroom', '$240 · full double bed']);
    });

    /**
     * ROYAL HOTEL SEOUL Myeongdong packs the guarantee in with another qualifier:
     * "(bed type is subject to availability, lounge access)" against "(lounge access)".
     * Matching the parenthetical whole missed every case like it and left the cards split.
     */
    it('merges when the guarantee is packed in with another qualifier', () => {
        render(<RoomSelection {...baseProps} rooms={[
            makeRoom({ id: 'r1', rates: [rate({ offerId: 'a' })],
                       name: 'Premier Twin room (twin beds) (bed type is subject to availability, lounge access)' }),
            makeRoom({ id: 'r2', rates: [rate({ offerId: 'b', price: 240 })],
                       name: 'Premier Twin room (twin beds) (lounge access)' }),
        ]} />);
        expect(screen.getAllByRole('article')).toHaveLength(1);
        const chips = within(screen.getByRole('radiogroup')).getAllByRole('radio');
        expect(chips.map(c => c.textContent)).toEqual(['$200 · bed not guaranteed', '$240']);
    });

    /**
     * ROYAL HOTEL SEOUL Myeongdong sells its premier twin as "Room only, non-refundable" at
     * both ₩40,406 and ₩41,759. Identical terms, ₩1,353 apart: the dearer is strictly worse,
     * and showing both is the look-alike pair this grouping exists to remove.
     */
    it('drops an offer whose terms match a cheaper one', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom({
            rates: [rate({ offerId: 'a', price: 200 }), rate({ offerId: 'b', price: 240 })],
        })]} />);
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByText('$200')).toBeInTheDocument();
    });

    /** A chip carries only what differs — a board every offer shares tells the reader nothing. */
    it('leaves a board shared by every offer off the chips', () => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom({
            rates: [
                rate({ offerId: 'a', price: 200 }),
                rate({ offerId: 'b', price: 240, refundable: false, refundableTag: 'NON_REFUNDABLE' }),
            ],
        })]} />);
        const chips = within(screen.getByRole('radiogroup')).getAllByRole('radio');
        expect(chips.map(c => c.textContent))
            .toEqual(['$200 · free to Sep 9', '$240 · non-refundable']);
    });
});

describe('RoomSelection — categorised modal', () => {
    const content: RoomContent = {
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
        expect(within(dialog).getByText('Amenities')).toBeInTheDocument();
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

        // The gallery counts its own place too, so the viewer's counter is the one outside the dialog.
        const viewerCounters = () => screen.queryAllByText('1 / 2').filter(el => !dialog.contains(el));

        fireEvent.click(dialog.querySelectorAll('img')[0]);
        // Viewer counter appears…
        expect(viewerCounters()).toHaveLength(1);
        // …and the room-detail modal is still mounted behind it.
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Dismissing the viewer (Escape) must not also close the modal.
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(viewerCounters()).toHaveLength(0);
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

    /**
     * ETG files tens of thousands of properties with room groups that carry no pictures —
     * Sangbong May has three groups and zero photos between them. Every card then drew the same
     * building shot, and three rooms at three prices under one identical photo reads as a broken
     * page rather than as missing data.
     */
    it('gives each photo-less room a different property shot', () => {
        const rooms = [
            makeRoom({ id: 'a', name: 'Standard room', price: 100, rates: [{ ...makeRoom().rates![0], offerId: 'a', price: 100 }] }),
            makeRoom({ id: 'b', name: 'Suite',         price: 200, rates: [{ ...makeRoom().rates![0], offerId: 'b', price: 200 }] }),
            makeRoom({ id: 'c', name: 'Royal Suite',   price: 300, rates: [{ ...makeRoom().rates![0], offerId: 'c', price: 300 }] }),
        ];
        render(<RoomSelection {...baseProps} rooms={rooms} image={HOTEL_SHOT} images={['/p1.jpg', '/p2.jpg', '/p3.jpg']} />);

        const leads = screen.getAllByRole('article').map(card => card.querySelector('img')?.getAttribute('src'));
        expect(leads).toEqual(['/p1.jpg', '/p2.jpg', '/p3.jpg']);
    });

    it('cycles when the property has fewer photos than rooms', () => {
        const rooms = [
            makeRoom({ id: 'a', name: 'Standard room', price: 100, rates: [{ ...makeRoom().rates![0], offerId: 'a', price: 100 }] }),
            makeRoom({ id: 'b', name: 'Suite',         price: 200, rates: [{ ...makeRoom().rates![0], offerId: 'b', price: 200 }] }),
            makeRoom({ id: 'c', name: 'Royal Suite',   price: 300, rates: [{ ...makeRoom().rates![0], offerId: 'c', price: 300 }] }),
        ];
        render(<RoomSelection {...baseProps} rooms={rooms} image={HOTEL_SHOT} images={['/p1.jpg', '/p2.jpg']} />);

        const leads = screen.getAllByRole('article').map(card => card.querySelector('img')?.getAttribute('src'));
        expect(leads).toEqual(['/p1.jpg', '/p2.jpg', '/p1.jpg']);
    });

    it('still prefers the room’s own photo over the property set', () => {
        const rooms = [
            makeRoom({ id: 'a', name: 'Standard room', roomPhotos: ['/actual-room.jpg'], rates: [{ ...makeRoom().rates![0], offerId: 'a', price: 100 }] }),
        ];
        render(<RoomSelection {...baseProps} rooms={rooms} image={HOTEL_SHOT} images={['/p1.jpg', '/p2.jpg']} />);
        expect(screen.getByRole('article').querySelector('img')?.getAttribute('src')).toBe('/actual-room.jpg');
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

/**
 * The split layout (Room Details Modal 1a): a gallery on the left — one large photo, a counter,
 * a strip of thumbnails — and the room on the right, with the price and Select pinned below it.
 */
describe('RoomSelection — room details modal, split layout', () => {
    const openWith = (overrides: Partial<RoomOption> = {}, props: Record<string, unknown> = {}) => {
        render(<RoomSelection {...baseProps} rooms={[makeRoom(overrides)]} {...props} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
        return screen.getByRole('dialog');
    };
    const mainPhoto = (dialog: HTMLElement) => within(dialog).getByTestId('room-gallery-main').getAttribute('src');

    it('leads with the first photo and swaps it for the thumbnail pressed', () => {
        const dialog = openWith({ roomPhotos: ['/a.jpg', '/b.jpg', '/c.jpg'] });
        expect(mainPhoto(dialog)).toBe('/a.jpg');
        expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Photo 2 of 3' }));
        expect(mainPhoto(dialog)).toBe('/b.jpg');
        expect(within(dialog).getByText('2 / 3')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Photo 2 of 3' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('moves through the photos with the arrow keys, round from the last to the first', () => {
        const dialog = openWith({ roomPhotos: ['/a.jpg', '/b.jpg', '/c.jpg'] });
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(mainPhoto(dialog)).toBe('/b.jpg');
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(mainPhoto(dialog)).toBe('/c.jpg');
    });

    it('counts what the strip cannot hold on its last tile, which opens the viewer there', () => {
        const photos = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg', '/6.jpg'];
        const dialog = openWith({ roomPhotos: photos });
        expect(within(dialog).getAllByRole('button', { name: /^Photo \d of 6$/ })).toHaveLength(3);

        fireEvent.click(within(dialog).getByRole('button', { name: '+3 more photos' }));
        expect(screen.getAllByText('4 / 6').filter(el => !dialog.contains(el))).toHaveLength(1);
    });

    it('draws a placeholder and no strip when there is no photo at all', () => {
        const dialog = openWith({ roomPhotos: [] });
        expect(within(dialog).getByTestId('room-gallery-placeholder')).toBeInTheDocument();
        expect(dialog.querySelectorAll('img')).toHaveLength(0);
        expect(within(dialog).queryAllByRole('button', { name: /^Photo \d+ of/ })).toHaveLength(0);
    });

    it('states the meal plan and the cancellation terms as policy badges', () => {
        const dialog = openWith();
        expect(within(dialog).getByText('Policies')).toBeInTheDocument();
        expect(within(dialog).getByText('Room Only').closest('[data-slot="badge"]')).not.toBeNull();
        expect(within(dialog).getByText('Free cancellation').closest('[data-slot="badge"]')).not.toBeNull();
    });

    it('marks a non-refundable rate as such', () => {
        const dialog = openWith({
            rates: [{ offerId: 'o', price: 200, currency: 'USD', boardCode: 'RO', refundable: false, refundableTag: 'NON_REFUNDABLE' }],
        });
        expect(within(dialog).getByText('Non-refundable').closest('[data-slot="badge"]')).not.toBeNull();
        expect(within(dialog).queryByText('Free cancellation')).not.toBeInTheDocument();
    });

    it('closes on Escape, on its close button and on the backdrop', () => {
        openWith();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Room details' })[0]);
        fireEvent.click(screen.getByTestId('room-dialog-backdrop'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('takes focus when it opens and keeps Tab inside it', () => {
        const dialog = openWith({ roomPhotos: ['/a.jpg', '/b.jpg'] });
        const close = within(dialog).getByRole('button', { name: 'Close' });
        const select = within(dialog).getByRole('button', { name: 'Select room' });
        expect(document.activeElement).toBe(close);

        select.focus();
        fireEvent.keyDown(select, { key: 'Tab' });
        expect(document.activeElement).toBe(close);

        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(select);
    });
});
