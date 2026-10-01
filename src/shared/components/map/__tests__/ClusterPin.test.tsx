import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClusterPin } from '../ClusterPin';

/**
 * What a cluster marker claims before the search knows the answer.
 *
 * A search paints the catalog immediately and learns availability ten-odd seconds later, so
 * an unpriced cluster stands for hotels in the area, not hotels anyone can book. Reading
 * "89 hotels" and then landing on two is the map promising something the search had not yet
 * found out — so an unpriced cluster says it is still checking.
 */

describe('ClusterPin', () => {
    it('does not claim bookable hotels before it has a price', () => {
        render(<ClusterPin count={89} priceLabel="" />);

        expect(screen.getByText(/checking 89/i)).toBeInTheDocument();
        expect(screen.queryByText('89 hotels')).toBeNull();
    });

    it('states the count once availability is known', () => {
        render(<ClusterPin count={89} priceLabel="₩24,409" />);

        expect(screen.getByText('89 hotels')).toBeInTheDocument();
        expect(screen.getByText(/from ₩24,409/)).toBeInTheDocument();
        expect(screen.queryByText(/checking/i)).toBeNull();
    });
});
