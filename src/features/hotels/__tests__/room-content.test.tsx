import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailSectionGrid, KeyFactsRow } from '@/features/hotels/components/room-content';
import type { DetailSection, DetailItem } from '@/features/hotels/types/property.types';

const palette = { heading: '', feature: 'text-x', columnHeading: '', columnDot: '', empty: '' } as any;

describe('DetailSectionGrid', () => {
    it('renders one header per section and its items', () => {
        const sections: DetailSection[] = [
            { id: 'bathroom', title: 'Bathroom', scope: 'room', items: [{ label: 'Shower' }, { label: 'Towels' }] },
            { id: 'kitchen', title: 'Kitchen facilities', scope: 'room', items: [{ label: 'Refrigerator' }] },
        ];
        render(<DetailSectionGrid sections={sections} palette={palette} />);
        expect(screen.getByText('Bathroom')).toBeInTheDocument();
        expect(screen.getByText('Kitchen facilities')).toBeInTheDocument();
        expect(screen.getByText('Shower')).toBeInTheDocument();
        expect(screen.getByText('Refrigerator')).toBeInTheDocument();
    });

    it('renders nothing when there are no sections', () => {
        const { container } = render(<DetailSectionGrid sections={[]} palette={palette} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows a note beside an item when present', () => {
        const sections: DetailSection[] = [
            { id: 'beds-extra', title: 'Cribs and extra beds', scope: 'property',
                items: [{ label: 'Extra bed', note: 'EUR 25 per night' }] },
        ];
        render(<DetailSectionGrid sections={sections} palette={palette} />);
        expect(screen.getByText('EUR 25 per night')).toBeInTheDocument();
    });
});

describe('KeyFactsRow', () => {
    it('renders each fact label, no header', () => {
        const facts: DetailItem[] = [{ label: 'Non-smoking' }, { label: '25 m²' }];
        render(<KeyFactsRow facts={facts} palette={palette} />);
        expect(screen.getByText('Non-smoking')).toBeInTheDocument();
        expect(screen.getByText('25 m²')).toBeInTheDocument();
    });
    it('renders nothing for an empty list', () => {
        const { container } = render(<KeyFactsRow facts={[]} palette={palette} />);
        expect(container).toBeEmptyDOMElement();
    });
});
