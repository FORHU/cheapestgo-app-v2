import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertyDescription } from '@/features/hotels/components/property-description';

vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('PropertyDescription — grouped amenities', () => {
    it('renders a labelled group per amenityGroups entry when provided', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={['Free WiFi']}
                amenityGroups={[
                    { groupName: 'Internet', amenities: ['Free WiFi in all rooms'], nonFree: [] },
                    { groupName: 'Parking',  amenities: ['Free private parking'],   nonFree: [] },
                ]}
            />,
        );
        expect(screen.getByText('Internet')).toBeInTheDocument();
        expect(screen.getByText('Parking')).toBeInTheDocument();
        expect(screen.getByText('Free WiFi in all rooms')).toBeInTheDocument();
    });

    it('drops an empty group', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={[]}
                amenityGroups={[
                    { groupName: 'Internet', amenities: ['WiFi'], nonFree: [] },
                    { groupName: 'Empty',    amenities: [],       nonFree: [] },
                ]}
            />,
        );
        expect(screen.getByText('Internet')).toBeInTheDocument();
        expect(screen.queryByText('Empty')).not.toBeInTheDocument();
    });

    it('falls back to a single "Amenities" group from the flat list when amenityGroups is absent', () => {
        render(<PropertyDescription tone="dark" amenities={['24 hour reception', 'Elevator']} />);
        expect(screen.getByText('Amenities')).toBeInTheDocument();
        expect(screen.getByText('Elevator')).toBeInTheDocument();
    });

    it('renders nothing when there is no content at all', () => {
        const { container } = render(<PropertyDescription tone="dark" amenities={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
