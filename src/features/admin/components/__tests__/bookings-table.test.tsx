import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingsTable } from '@/features/admin/components/bookings-table';
import type { Booking } from '@/shared/types';

/**
 * `GET /api/admin/bookings` used to return raw Prisma rows — `user_id`, `total_price`,
 * `created_at` — while this table reads `userId`, `totalAmount`, `createdAt`. One real
 * booking took the whole page down on `booking.userId.slice()`.
 *
 * Fixed on both sides: the endpoint now normalises to the shape the client declares,
 * and the table no longer assumes every field is present. A back office is where you
 * go when something has already gone wrong, so it should degrade rather than blank.
 */

/** The shape the endpoint now returns. */
const normalised: Booking & { summary?: string } = {
    id: 'b-1',
    userId: 'u-123456789',
    type: 'hotel',
    status: 'confirmed' as Booking['status'],
    totalAmount: 11533,
    currency: 'PHP',
    createdAt: '2026-08-01T00:00:00Z',
    reference: 'CG-123',
};

/** A row missing everything optional — the degenerate case. */
const degenerate = { id: 'b-2', status: 'confirmed', type: 'flight' } as unknown as Booking;

describe('admin BookingsTable', () => {
    it('renders the normalised shape the endpoint returns', () => {
        render(<BookingsTable bookings={[normalised]} userEmailMap={{}} />);
        expect(screen.getByText('CG-123')).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
        expect(screen.queryByText(/Invalid Date/)).toBeNull();
    });

    it('prefers a known email over the raw user id', () => {
        render(<BookingsTable bookings={[normalised]} userEmailMap={{ 'u-123456789': 'maria@example.com' }} />);
        expect(screen.getByText('maria@example.com')).toBeTruthy();
    });

    it('does not crash on a row with fields missing', () => {
        // This threw before: userId was undefined and the cell called .slice() on it.
        expect(() => render(<BookingsTable bookings={[degenerate]} userEmailMap={{}} />)).not.toThrow();
    });

    it('shows a dash rather than NaN when the amount is absent', () => {
        render(<BookingsTable bookings={[degenerate]} userEmailMap={{}} />);
        expect(screen.queryByText(/NaN/)).toBeNull();
    });
});
