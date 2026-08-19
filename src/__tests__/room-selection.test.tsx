import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomSelection } from '@/features/hotels/components/room-selection';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import type { RoomOption } from '@/features/hotels/components/room-list';

afterEach(cleanup);

/** The section reads the app theme as its `tone` default, so it wants the
 *  provider the app mounts at its root. */
const render = (ui: React.ReactElement) => rtlRender(<ThemeProvider>{ui}</ThemeProvider>);

const room = (over: Partial<RoomOption> = {}): RoomOption => ({
    id: 'r1',
    name: 'Comfort Leisure Room',
    price: 169,
    currency: 'USD',
    ...over,
});

const base = {
    tone: 'dark' as const,
    selectedRoomId: null,
    onSelect: () => {},
};

/** The room names currently on screen, in order. */
const shownRooms = () => screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);

describe('RoomSelection', () => {
    it('starts on All, with every room showing', () => {
        render(<RoomSelection {...base} rooms={[room({ id: 'a', name: 'A' }), room({ id: 'b', name: 'B' })]} />);
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
        expect(shownRooms()).toEqual(['A', 'B']);
    });

    it('keeps only board codes that feed you in the morning', async () => {
        const user = userEvent.setup();
        render(
            <RoomSelection
                {...base}
                rooms={[
                    room({ id: 'a', name: 'Bed and breakfast', boardType: 'BB' }),
                    room({ id: 'b', name: 'All inclusive',     boardType: 'AI' }),
                    room({ id: 'c', name: 'Room only',         boardType: 'RO' }),
                    room({ id: 'd', name: 'Unstated' }),
                ]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Breakfast Included' }));
        expect(shownRooms()).toEqual(['Bed and breakfast', 'All inclusive']);
    });

    it('treats anything not flagged RFN as non-refundable', async () => {
        const user = userEvent.setup();
        render(
            <RoomSelection
                {...base}
                rooms={[
                    room({ id: 'a', name: 'Refundable',   refundableTag: 'RFN' }),
                    room({ id: 'b', name: 'Non-refund',   refundableTag: 'NRFN' }),
                    room({ id: 'c', name: 'Unflagged' }),
                ]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Refundable' }));
        expect(shownRooms()).toEqual(['Refundable']);

        // The inversion is the point: suppliers are reliable about flagging RFN
        // and patchy about flagging its opposite, so testing for NRFN alone
        // would silently drop every rate that carries no tag at all.
        await user.click(screen.getByRole('button', { name: 'Non-refundable' }));
        expect(shownRooms()).toEqual(['Non-refund', 'Unflagged']);
    });

    it('says so when a filter matches nothing', async () => {
        const user = userEvent.setup();
        render(<RoomSelection {...base} rooms={[room({ boardType: 'RO' })]} />);

        await user.click(screen.getByRole('button', { name: 'Breakfast Included' }));
        expect(screen.getByText(/No rooms match that rate/)).toBeInTheDocument();
    });

    it('names the board code on the card', () => {
        render(<RoomSelection {...base} rooms={[room({ boardType: 'RO' })]} />);
        expect(screen.getByText('No Breakfast Included')).toBeInTheDocument();
    });

    it('draws no board row for a code it does not recognise', () => {
        render(<RoomSelection {...base} rooms={[room({ boardType: 'ZZ', bedType: '1 double bed' })]} />);
        // Neither claim is safe from an unknown code, so the row is left off —
        // asserted on the card's own rows, since "Breakfast Included" is also
        // the name of a filter chip above it.
        expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['1 double bed']);
    });

    it('reads the bed out of the room name when the rate does not carry one', () => {
        render(<RoomSelection {...base} rooms={[room({ name: 'Superior Room, 2 twin beds' })]} />);
        expect(screen.getByText('2 twin beds')).toBeInTheDocument();
    });

    it('takes a bed implied by the name as one of them', () => {
        render(<RoomSelection {...base} rooms={[room({ name: 'Double Room' })]} />);
        expect(screen.getByText('1 double bed')).toBeInTheDocument();
    });

    it('prefers the rate own bed type over anything in the name', () => {
        render(<RoomSelection {...base} rooms={[room({ name: 'Double Room', bedType: '1 king bed' })]} />);
        expect(screen.getByText('1 king bed')).toBeInTheDocument();
        expect(screen.queryByText('1 double bed')).not.toBeInTheDocument();
    });

    it('claims no bed from a name that names none', () => {
        render(<RoomSelection {...base} rooms={[room({ name: 'Comfort Leisure Room' })]} />);
        expect(screen.queryByText(/bed/i)).not.toBeInTheDocument();
    });

    it('falls back to the in-room half of the hotel amenities', () => {
        render(
            <RoomSelection
                {...base}
                rooms={[room()]}
                hotelAmenities={['Free Wi-Fi', 'Air conditioning', 'Outdoor pool', 'Free parking']}
            />,
        );
        expect(screen.getByText('Free Wi-Fi')).toBeInTheDocument();
        expect(screen.getByText('Air conditioning')).toBeInTheDocument();
        // A pool and a car park are the building's, not the room's.
        expect(screen.queryByText('Outdoor pool')).not.toBeInTheDocument();
        expect(screen.queryByText('Free parking')).not.toBeInTheDocument();
    });

    it('leaves the hotel list alone when the rate brought its own', () => {
        render(
            <RoomSelection
                {...base}
                rooms={[room({ amenities: ['Rainfall shower'] })]}
                hotelAmenities={['Free Wi-Fi', 'Air conditioning']}
            />,
        );
        expect(screen.getByText('Rainfall shower')).toBeInTheDocument();
        expect(screen.queryByText('Free Wi-Fi')).not.toBeInTheDocument();
    });

    it('offers View more only once the features outrun the card', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <RoomSelection {...base} rooms={[room({ bedType: '1 double bed', amenities: ['City view', 'Wi-Fi'] })]} />,
        );
        expect(screen.queryByRole('button', { name: 'View more' })).not.toBeInTheDocument();
        unmount();

        render(
            <RoomSelection
                {...base}
                rooms={[room({
                    bedType: '1 double bed',
                    amenities: ['City view', 'Wi-Fi', 'Air conditioning', 'Minibar', 'Private bathroom'],
                })]}
            />,
        );
        expect(screen.queryByText('Private bathroom')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'View more' }));
        expect(screen.getByText('Private bathroom')).toBeInTheDocument();
    });

    it('selects without the card underneath swallowing the click', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(<RoomSelection {...base} rooms={[room({ id: 'r7' })]} onSelect={onSelect} />);

        await user.click(screen.getByRole('button', { name: 'Select Room' }));
        // Once, not twice: the button sits inside a card that is itself a
        // selection target, and its click must not bubble into it.
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('r7');
    });

    it('lights the picked room', () => {
        render(<RoomSelection {...base} rooms={[room({ id: 'r7' })]} selectedRoomId="r7" />);
        const button = screen.getByRole('button', { name: 'Selected' });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('prices in the room currency, with the symbol', () => {
        render(<RoomSelection {...base} rooms={[room({ price: 2450, currency: 'PHP' })]} />);
        const card = screen.getByRole('heading', { level: 4 }).closest('div')!;
        expect(within(card.parentElement!).getByText('₱2,450')).toBeInTheDocument();
    });

    it('renders nothing when the stay has no rooms', () => {
        const { container } = render(<RoomSelection {...base} rooms={[]} className="section-under-test" />);
        expect(container.querySelector('.section-under-test')).toBeNull();
    });
});
