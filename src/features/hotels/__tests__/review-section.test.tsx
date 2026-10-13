import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import { describe, it, expect, vi } from 'vitest';
import { ReviewSection } from '@/features/hotels/components/review-section';

// ReviewForm does a fetch on submit — stub it so the module loads cleanly
global.fetch = vi.fn();

const baseProps = {
    hotelId:      'hotel-1',
    reviewScore:  0,
    reviewCount:  0,
    reviewItems:  [],
};

describe('ReviewSection', () => {
    it('always renders the "What guests say" heading', () => {
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} />
        </NextIntlClientProvider>,
    );
        expect(screen.getByText('What guests say')).toBeInTheDocument();
    });

    it('hides the score summary when reviewScore is 0', () => {
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} reviewScore={0} />
        </NextIntlClientProvider>,
    );
        expect(screen.queryByText(/exceptional|excellent|good/i)).not.toBeInTheDocument();
    });

    it('shows score summary with correct label when reviewScore >= 8', () => {
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} reviewScore={8.2} reviewCount={762} />
        </NextIntlClientProvider>,
    );
        expect(screen.getByText('8.2')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
        expect(screen.getByText('762')).toBeInTheDocument();
    });

    it('shows "Exceptional" label for score >= 9', () => {
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} reviewScore={9.1} reviewCount={10} />
        </NextIntlClientProvider>,
    );
        expect(screen.getByText('Exceptional')).toBeInTheDocument();
    });

    it('renders review cards for each review item', () => {
        const items = [
            { reviewer_name: 'Alice', score: 9, pros: 'Amazing view', cons: null, headline: null, country: 'PH' },
            { reviewer_name: 'Bob',   score: 7, pros: null,           cons: null, headline: 'Okay stay', country: null },
        ];
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} reviewItems={items} />
        </NextIntlClientProvider>,
    );
        expect(screen.getByText(/Amazing view/i)).toBeInTheDocument();
        expect(screen.getByText(/Okay stay/i)).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders ReviewForm inside the section', () => {
        render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
            <ReviewSection {...baseProps} />
        </NextIntlClientProvider>,
    );
        expect(screen.getByText('Share your experience')).toBeInTheDocument();
    });
});
