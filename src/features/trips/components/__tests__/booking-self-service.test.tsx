/**
 * The two post-booking actions v1 had and v2 did not, so a v2 booking could be paid for
 * and then only looked at.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const post = vi.fn();
vi.mock('@/shared/lib/http', () => ({ http: { post: (...a: unknown[]) => post(...a) } }));

import { SpecialRequestsForm, ShareBookingForm } from '../booking-self-service';

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

const booking = {
    id: 'row-1', booking_id: 'GG-2026-1',
    holder_first_name: 'Juan', holder_last_name: 'Dela Cruz', holder_email: 'juan@example.com',
    special_requests: 'High floor please',
};

describe('special requests', () => {
    beforeEach(() => { post.mockReset(); post.mockResolvedValue({}); });

    it('opens with what the property was already asked for', () => {
        wrap(<SpecialRequestsForm booking={booking} />);
        expect(screen.getByDisplayValue('High floor please')).toBeInTheDocument();
    });

    it('amends against the booking reference, not the row id', async () => {
        wrap(<SpecialRequestsForm booking={booking} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Late arrival, 11pm' } });
        fireEvent.click(screen.getByRole('button', { name: /save request/i }));

        await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/amend', expect.objectContaining({
            bookingId: 'GG-2026-1',
            remarks:   'Late arrival, 11pm',
        })));
        expect(await screen.findByText(/the property has been notified/i)).toBeInTheDocument();
    });

    it('never promises the property has agreed', () => {
        wrap(<SpecialRequestsForm booking={booking} />);
        expect(screen.getByText(/are not guaranteed/i)).toBeInTheDocument();
    });

    it('says so when the save fails, rather than looking saved', async () => {
        post.mockRejectedValue(new Error('Network unreachable'));
        wrap(<SpecialRequestsForm booking={booking} />);
        fireEvent.click(screen.getByRole('button', { name: /save request/i }));
        expect(await screen.findByText('Network unreachable')).toBeInTheDocument();
        expect(screen.queryByText(/the property has been notified/i)).not.toBeInTheDocument();
    });
});

describe('sharing a confirmation', () => {
    beforeEach(() => { post.mockReset(); post.mockResolvedValue({}); });

    it('sends to the address typed, against the row id the API addresses', async () => {
        wrap(<ShareBookingForm bookingId="row-1" defaultEmail="juan@example.com" />);
        fireEvent.change(screen.getByLabelText(/send to/i), { target: { value: 'companion@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: /send confirmation/i }));

        await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/row-1/share', { email: 'companion@example.com' }));
        expect(await screen.findByText(/sent to companion@example.com/i)).toBeInTheDocument();
    });

    it('reports a failure instead of claiming it was sent', async () => {
        post.mockRejectedValue(new Error('Could not send the confirmation just now.'));
        wrap(<ShareBookingForm bookingId="row-1" defaultEmail="juan@example.com" />);
        fireEvent.click(screen.getByRole('button', { name: /send confirmation/i }));
        expect(await screen.findByText(/could not send the confirmation/i)).toBeInTheDocument();
        expect(screen.queryByText(/^sent to /i)).not.toBeInTheDocument();
    });
});
