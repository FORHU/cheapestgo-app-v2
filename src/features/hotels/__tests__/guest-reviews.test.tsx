/**
 * The property page's guest reviews: the hotel's score, its written reviews with v1's sort and
 * "Load more", and nothing at all for a hotel with neither.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { GuestReviews, sortReviews } from '@/features/hotels/components/guest-reviews';
import type { ReviewItem } from '@/features/hotels/types/property.types';

const review = (over: Partial<ReviewItem>): ReviewItem => ({
    reviewer_name: 'Guest', score: 8, pros: null, cons: null, headline: null, country: null, ...over,
});

/** The reviewer on each card, top to bottom — the first line of its header. */
const names = () => screen.getAllByRole('article').map(a => a.querySelector('header p')?.textContent);

describe('sortReviews', () => {
    const items = [
        review({ reviewer_name: 'A', score: 7, review_date: '2026-01-10' }),
        review({ reviewer_name: 'B', score: 9.5, review_date: 'last summer' }),
        review({ reviewer_name: 'C', score: 9.5, review_date: '2026-06-02' }),
    ];
    const order = (s: Parameters<typeof sortReviews>[1]) => sortReviews(items, s).map(r => r.reviewer_name);

    it('puts the newest first, and an undated review after every dated one', () => {
        expect(order('newest')).toEqual(['C', 'A', 'B']);
    });

    it('sorts by score either way, keeping api order between ties', () => {
        expect(order('highest')).toEqual(['B', 'C', 'A']);
        expect(order('lowest')).toEqual(['A', 'B', 'C']);
    });
});

describe('GuestReviews', () => {
    it('renders nothing for a hotel with no score and no reviews', () => {
        const { container } = renderWithIntl(<GuestReviews tone="light" rating={0} count={0} items={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the score with its label and count, and says when there is nothing written', () => {
        renderWithIntl(<GuestReviews tone="light" rating={8.6} count={1240} items={[]} />);
        expect(screen.getByTestId('reviews-score')).toHaveTextContent('8.6');
        expect(screen.getByText('Excellent')).toBeInTheDocument();
        expect(screen.getByText('Based on 1,240 reviews')).toBeInTheDocument();
        expect(screen.getByText('No individual reviews available.')).toBeInTheDocument();
    });

    it('shows six reviews, then six more on "Load more"', async () => {
        const user = userEvent.setup();
        const items = Array.from({ length: 9 }, (_, i) => review({ reviewer_name: `Guest ${i + 1}`, score: 9 - i * 0.1 }));
        renderWithIntl(<GuestReviews tone="dark" rating={8.9} count={9} items={items} />);

        expect(screen.getAllByRole('article')).toHaveLength(6);
        expect(screen.getByText('Showing 6 of 9 reviews')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Load more reviews' }));

        expect(screen.getAllByRole('article')).toHaveLength(9);
        expect(screen.queryByRole('button', { name: 'Load more reviews' })).not.toBeInTheDocument();
    });

    it('re-sorts on a sort pill and marks it pressed', async () => {
        const user = userEvent.setup();
        renderWithIntl(
            <GuestReviews
                tone="light"
                rating={8}
                count={2}
                items={[review({ reviewer_name: 'High', score: 9.8 }), review({ reviewer_name: 'Low', score: 5.2 })]}
            />,
        );
        const lowest = screen.getByRole('button', { name: 'Lowest rated' });
        await user.click(lowest);
        expect(lowest).toHaveAttribute('aria-pressed', 'true');
        expect(names()).toEqual(['Low', 'High']);
    });

    it('draws a review in full: who, from where, when, the score and both sides', () => {
        renderWithIntl(
            <GuestReviews
                tone="light"
                rating={9.1}
                count={1}
                items={[review({
                    reviewer_name: 'Mina', country: 'South Korea', traveler_type: 'couple', review_date: '2026-03-14',
                    score: 9.2, headline: 'Lovely bay views', pros: 'Friendly staff', cons: 'Small gym',
                })]}
            />,
        );
        const card = screen.getByRole('article');
        expect(card).toHaveTextContent('Mina');
        expect(card).toHaveTextContent('South Korea · Couple · Mar 2026');
        expect(card).toHaveTextContent('9.2');
        expect(card).toHaveTextContent('Lovely bay views');
        expect(card).toHaveTextContent('Friendly staff');
        expect(card).toHaveTextContent('Small gym');
    });

    it('cuts a long review behind "Show More"', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GuestReviews tone="light" rating={8} count={1} items={[review({ pros: 'x'.repeat(400) })]} />);
        const more = screen.getByRole('button', { name: 'Show More' });
        await user.click(more);
        expect(screen.getByRole('button', { name: 'Show Less' })).toHaveAttribute('aria-expanded', 'true');
    });
});
