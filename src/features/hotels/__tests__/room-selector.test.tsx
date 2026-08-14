import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoomSelector } from '@/features/hotels/components/room-selector';

// Stub Zustand currency store
vi.mock('@/stores/searchStore', () => ({
    useUserCurrency: () => 'USD',
}));

// Stub currency lib — return amount as-is for predictable assertions
vi.mock('@/shared/lib/currency', () => ({
    convertCurrency: (amount: number) => amount,
    getCurrencySymbol: () => '$',
    EXCHANGE_RATES: { USD: 1 },
}));

const makeRoom = (overrides = {}) => ({
    id:            'room-1',
    offerId:       'offer-1',
    name:          'Deluxe Room',
    price:         150,
    currency:      'USD',
    refundableTag: 'NRFN',
    boardType:     'RO',
    ...overrides,
});

describe('RoomSelector', () => {
    it('renders each room name', () => {
        const rooms = [makeRoom({ id: 'r1', name: 'Standard Room' }), makeRoom({ id: 'r2', name: 'Suite' })];
        render(<RoomSelector rooms={rooms} selectedRoomId={null} onSelect={vi.fn()} />);
        expect(screen.getByText('Standard Room')).toBeInTheDocument();
        expect(screen.getByText('Suite')).toBeInTheDocument();
    });

    it('shows "Free cancellation" badge for refundable rooms', () => {
        render(<RoomSelector rooms={[makeRoom({ refundableTag: 'RFN' })]} selectedRoomId={null} onSelect={vi.fn()} />);
        expect(screen.getByText('Free cancellation')).toBeInTheDocument();
    });

    it('does not show "Free cancellation" for non-refundable rooms', () => {
        render(<RoomSelector rooms={[makeRoom({ refundableTag: 'NRFN' })]} selectedRoomId={null} onSelect={vi.fn()} />);
        expect(screen.queryByText('Free cancellation')).not.toBeInTheDocument();
    });

    it('shows "Breakfast included" badge for BB board type', () => {
        render(<RoomSelector rooms={[makeRoom({ boardType: 'BB' })]} selectedRoomId={null} onSelect={vi.fn()} />);
        expect(screen.getByText('Breakfast included')).toBeInTheDocument();
    });

    it('calls onSelect with room id when Select button clicked', () => {
        const onSelect = vi.fn();
        render(<RoomSelector rooms={[makeRoom()]} selectedRoomId={null} onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: /select/i }));
        expect(onSelect).toHaveBeenCalledWith('room-1');
    });

    it('calls onSelect with null when already-selected room is clicked', () => {
        const onSelect = vi.fn();
        render(<RoomSelector rooms={[makeRoom()]} selectedRoomId="room-1" onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: /selected/i }));
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('shows only 4 rooms initially when there are more than 4', () => {
        const rooms = Array.from({ length: 6 }, (_, i) => makeRoom({ id: `r${i}`, name: `Room ${i + 1}` }));
        render(<RoomSelector rooms={rooms} selectedRoomId={null} onSelect={vi.fn()} />);
        expect(screen.getAllByText(/Room \d+/).length).toBe(4);
        expect(screen.getByText(/show 2 more/i)).toBeInTheDocument();
    });

    it('expands to show all rooms after clicking the toggle', () => {
        const rooms = Array.from({ length: 6 }, (_, i) => makeRoom({ id: `r${i}`, name: `Room ${i + 1}` }));
        render(<RoomSelector rooms={rooms} selectedRoomId={null} onSelect={vi.fn()} />);
        fireEvent.click(screen.getByText(/show 2 more/i));
        expect(screen.getAllByText(/Room \d+/).length).toBe(6);
        expect(screen.getByText(/show less/i)).toBeInTheDocument();
    });
});
