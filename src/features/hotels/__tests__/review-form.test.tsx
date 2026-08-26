import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewForm } from '@/features/hotels/components/review-form';

// Stub global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReviewForm', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('renders the heading and 5 star buttons', () => {
        render(<ReviewForm hotelId="hotel-1" />);
        expect(screen.getByText('Share your experience')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /star/i })).toHaveLength(5);
    });

    it('Post review button is disabled when no star or body', () => {
        render(<ReviewForm hotelId="hotel-1" />);
        const submit = screen.getByRole('button', { name: /post review/i });
        expect(submit).toBeDisabled();
    });

    it('Post review button stays disabled when only stars selected', async () => {
        render(<ReviewForm hotelId="hotel-1" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[2]);
        expect(screen.getByRole('button', { name: /post review/i })).toBeDisabled();
    });

    it('Post review button enables when stars + body are both filled', async () => {
        render(<ReviewForm hotelId="hotel-1" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[2]);
        await userEvent.type(screen.getByPlaceholderText(/tell others/i), 'Great place!');
        expect(screen.getByRole('button', { name: /post review/i })).not.toBeDisabled();
    });

    it('shows label text for selected star count', async () => {
        render(<ReviewForm hotelId="hotel-1" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[4]); // 5 stars
        expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('shows success message after successful submit', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        render(<ReviewForm hotelId="hotel-1" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[3]);
        await userEvent.type(screen.getByPlaceholderText(/tell others/i), 'Loved it');
        await userEvent.click(screen.getByRole('button', { name: /post review/i }));
        await waitFor(() => {
            expect(screen.getByText(/thank you for your review/i)).toBeInTheDocument();
        });
    });

    it('shows error message on failed submit', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });
        render(<ReviewForm hotelId="hotel-1" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[0]);
        await userEvent.type(screen.getByPlaceholderText(/tell others/i), 'Bad experience');
        await userEvent.click(screen.getByRole('button', { name: /post review/i }));
        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
    });

    it('POSTs to the correct endpoint with stars and body', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        render(<ReviewForm hotelId="hotel-42" />);
        await userEvent.click(screen.getAllByRole('button', { name: /star/i })[1]); // 2 stars
        await userEvent.type(screen.getByPlaceholderText(/tell others/i), 'Decent');
        await userEvent.click(screen.getByRole('button', { name: /post review/i }));
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('http://localhost:4000/api/v2/hotels/property/hotel-42/reviews');
        const body = JSON.parse(opts.body);
        expect(body.stars).toBe(2);
        expect(body.body).toBe('Decent');
    });
});
