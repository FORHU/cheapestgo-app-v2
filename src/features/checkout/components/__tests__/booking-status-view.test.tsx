import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const push = vi.fn();
const auth = { user: { email: 'juan@example.com' } as unknown, isLoading: false };
const status = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ reference: 'CG-ABC123' }) }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push }),
}));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => auth }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../hooks/use-booking-status', () => ({ useBookingStatus: (...a: unknown[]) => status(...a) }));

import { BookingStatusView } from '../booking-status-view';

const wrap = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><BookingStatusView /></NextIntlClientProvider>);

beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { email: 'juan@example.com' };
    auth.isLoading = false;
    status.mockReturnValue({ load: 'loading', outcome: null, exhausted: false, refresh: vi.fn() });
});

describe('BookingStatusView', () => {
    it('does not ask about a booking until it knows who is asking', () => {
        auth.isLoading = true;
        wrap();
        expect(status).not.toHaveBeenCalled();
        expect(screen.getByText(/checking your booking/i)).toBeInTheDocument();
    });

    it('asks a signed-out traveller to sign in rather than reporting a missing booking', () => {
        auth.user = null;
        wrap();
        expect(screen.getByText(/sign in to complete your booking/i)).toBeInTheDocument();
        expect(screen.queryByText(/couldn't find that booking/i)).not.toBeInTheDocument();
        expect(status).not.toHaveBeenCalled();
    });

    it('asks about the reference in the address, and no other', () => {
        wrap();
        expect(status).toHaveBeenCalledWith('CG-ABC123');
    });

    it('shows a confirmed booking with its reference', () => {
        status.mockReturnValue({
            load: 'ready', exhausted: false, refresh: vi.fn(),
            outcome: { kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' },
        });
        wrap();

        expect(screen.getByRole('status')).toHaveTextContent(/booked/i);
        expect(screen.getByText('CG-ABC123')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /view my trips/i })).toHaveAttribute('href', '/trips');
    });

    it('says a booking in progress is in progress, and that the page will update by itself', () => {
        status.mockReturnValue({
            load: 'ready', exhausted: false, refresh: vi.fn(),
            outcome: { kind: 'pending', reference: 'CG-ABC123', message: 'm' },
        });
        wrap();

        expect(screen.getByRole('status')).toHaveTextContent(/confirming your booking/i);
        expect(screen.getByText(/this page updates by itself/i)).toBeInTheDocument();
    });

    it('offers a refresh once polling has given up', () => {
        const refresh = vi.fn();
        status.mockReturnValue({
            load: 'ready', exhausted: true, refresh,
            outcome: { kind: 'needs_review', reference: 'CG-ABC123', message: 'm' },
        });
        wrap();

        expect(screen.queryByText(/this page updates by itself/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('shows a failure, and says the hold was released only when it was', () => {
        status.mockReturnValue({
            load: 'ready', exhausted: false, refresh: vi.fn(),
            outcome: { kind: 'failed', message: 'Room is gone', released: true },
        });
        wrap();
        expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
    });

    it('says a booking is not found', () => {
        status.mockReturnValue({ load: 'not_found', outcome: null, exhausted: false, refresh: vi.fn() });
        wrap();
        expect(screen.getByText(/couldn't find that booking/i)).toBeInTheDocument();
    });

    it('lets a failed load be tried again', () => {
        const refresh = vi.fn();
        status.mockReturnValue({ load: 'error', outcome: null, exhausted: false, refresh });
        wrap();
        fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
