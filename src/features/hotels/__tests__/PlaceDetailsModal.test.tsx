import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import { describe, it, expect, vi } from 'vitest';
import { PlaceDetailsModal } from '@/features/hotels/components/nearby/PlaceDetailsModal';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

const RICH = gem({
    userRatingsTotal: 1200,
    vicinity: '8 Achasan-ro',
    phone: '02-1234-5678',
    website: 'https://onion.example',
    openingHours: { open_now: true, weekday_text: ['Monday: 9 AM – 5 PM', 'Tuesday: 9 AM – 5 PM'] },
    reviews: [{ author_name: 'Min', rating: 5, text: 'Great bread', relative_time_description: 'a week ago' }],
});

function open(g = RICH, onClose = vi.fn()) {
    renderWithIntl(<PlaceDetailsModal gem={g} hotel={HOTEL} unit="km" palette={PALETTE} onClose={onClose} />);
    return onClose;
}

describe('PlaceDetailsModal', () => {
    it('renders nothing without a place', () => {
        renderWithIntl(<PlaceDetailsModal gem={null} hotel={HOTEL} unit="km" palette={PALETTE} onClose={vi.fn()} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the place, its rating, distance and contact links', () => {
        open();
        const dialog = screen.getByRole('dialog', { name: 'Cafe Onion' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('1,200 reviews')).toBeInTheDocument();
        expect(screen.getByText(/360 m away/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:02-1234-5678');
        expect(screen.getByRole('link', { name: /Website/ })).toHaveAttribute('href', 'https://onion.example');
        expect(screen.getByRole('link', { name: /Google Maps/ }).getAttribute('href')).toContain('query_place_id=g-1');
    });

    it('groups the opening hours and says whether it is open', () => {
        open();
        expect(screen.getByText('Opening Hours')).toBeInTheDocument();
        expect(screen.getByText('Open Now')).toBeInTheDocument();
        expect(screen.getByText('Monday - Tuesday: 9 AM – 5 PM')).toBeInTheDocument();
    });

    it('shows Google reviews and no form to write one', () => {
        open();
        expect(screen.getByText('Google Reviews')).toBeInTheDocument();
        expect(screen.getByText('Great bread')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('hides what it does not have', () => {
        open(gem());
        expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Website/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Opening Hours')).not.toBeInTheDocument();
        expect(screen.getByText('No direct reviews available for this place yet.')).toBeInTheDocument();
    });

    it('closes on Escape and on its close button', () => {
        const onClose = open();
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('moves focus to the close button and gives it back to the opener', () => {
        const ui = (g: ReturnType<typeof gem> | null) => (
            <NextIntlClientProvider locale="en" messages={enMessages as never}>
                <button>Opener</button><PlaceDetailsModal gem={g} hotel={HOTEL} unit="km" palette={PALETTE} onClose={vi.fn()} />
            </NextIntlClientProvider>
        );
        const { rerender } = render(ui(null));
        screen.getByRole('button', { name: 'Opener' }).focus();
        rerender(ui(RICH));
        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
        rerender(ui(null));
        expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
    });

    it('keeps Tab inside the dialog', () => {
        open();
        const dialog = screen.getByRole('dialog');
        const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        last.focus();
        fireEvent.keyDown(window, { key: 'Tab' });
        expect(first).toHaveFocus();
        first.focus();
        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();
    });

    it('locks body scroll while open and restores it on close', () => {
        document.body.style.overflow = 'auto';
        const { unmount } = renderWithIntl(<PlaceDetailsModal gem={RICH} hotel={HOTEL} unit="km" palette={PALETTE} onClose={vi.fn()} />);
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('auto');
    });
});
