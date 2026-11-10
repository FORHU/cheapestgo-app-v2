/**
 * `/flights/book` only hands a chosen flight over to checkout. It used to render nothing while it
 * did, and the page under it — the layout's footer — was all a phone showed until checkout arrived.
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';

let query = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));

import { FlightBookView } from '../flight-book-view';
import CheckoutLoading from '@/app/[locale]/checkout/loading';

beforeEach(() => {
    replace.mockReset();
});

describe('handing a flight over to checkout', () => {
    it('shows the checkout loading, not an empty page, while it goes', () => {
        query = 'offerId=off_1&origin=MNL&destination=NRT';
        renderWithIntl(<FlightBookView />);

        expect(screen.getByRole('status', { name: 'Loading checkout…' })).toBeInTheDocument();
        expect(replace).toHaveBeenCalledWith('/checkout?offerId=off_1&origin=MNL&destination=NRT');
    });

    it('goes home when there is no flight to book', () => {
        query = '';
        renderWithIntl(<FlightBookView />);
        expect(replace).toHaveBeenCalledWith('/');
    });
});

describe('the checkout route, while it loads', () => {
    it('draws the checkout loading, a screen tall, so the footer is not all there is', () => {
        const { container } = renderWithIntl(<CheckoutLoading />);
        expect(screen.getByRole('status', { name: 'Loading checkout…' })).toBeInTheDocument();
        expect(container.querySelector('[data-checkout-skeleton]')).toHaveClass('min-h-screen');
    });
});
