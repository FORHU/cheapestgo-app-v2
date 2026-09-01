import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertyDescription } from '@/features/hotels/components/property-description';

vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('PropertyDescription — amenities', () => {
    it('draws "General Amenities" from the near-universal amenities across every ETG group', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={['Free WiFi']}
                amenityGroups={[
                    { groupName: 'Internet', amenities: ['Free WiFi in all rooms'], nonFree: [] },
                    { groupName: 'General',  amenities: ['Air conditioning'],       nonFree: [] },
                    { groupName: 'Parking',  amenities: ['Free private parking'],   nonFree: [] },
                ]}
            />,
        );
        expect(screen.getByText('General Amenities')).toBeInTheDocument();
        // universal comforts, wherever ETG filed them
        expect(screen.getByText('Free WiFi in all rooms')).toBeInTheDocument();
        expect(screen.getByText('Air conditioning')).toBeInTheDocument();
        // a hotel-specific facility, not something every stay has — stays out of this row
        expect(screen.queryByText('Free private parking')).not.toBeInTheDocument();
        // the ETG category names are NOT rendered as headers
        expect(screen.queryByText('Internet')).not.toBeInTheDocument();
        expect(screen.queryByText('Parking')).not.toBeInTheDocument();
    });

    it('routes house-rule entries from amenityGroups into "Rules & Policies"', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={[]}
                amenityGroups={[
                    { groupName: 'General', amenities: ['Elevator'], nonFree: [] },
                    { groupName: 'Pets',    amenities: ['Pets not allowed'], nonFree: [] },
                ]}
            />,
        );
        expect(screen.getByText('Rules & Policies')).toBeInTheDocument();
        expect(screen.getByText('Pets not allowed')).toBeInTheDocument();
        expect(screen.getByText('Elevator')).toBeInTheDocument();
    });

    it('de-duplicates amenities that appear in more than one ETG group', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={[]}
                amenityGroups={[
                    { groupName: 'General',  amenities: ['Free Wi-Fi'], nonFree: [] },
                    { groupName: 'Internet', amenities: ['Free Wi-Fi'], nonFree: [] },
                ]}
            />,
        );
        expect(screen.getAllByText('Free Wi-Fi')).toHaveLength(1);
    });

    it('caps "General Amenities" at five and never shows a "View more"', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={[]}
                amenityGroups={[
                    {
                        groupName: 'General',
                        amenities: ['Wi-Fi', 'Air conditioning', 'Heating', 'Private bathroom', 'Free toiletries', 'TV', 'Desk'],
                        nonFree: [],
                    },
                ]}
            />,
        );
        expect(screen.getByText('Wi-Fi')).toBeInTheDocument();
        expect(screen.getByText('Free toiletries')).toBeInTheDocument();
        // seven universal amenities offered, only the first five drawn
        const drawn = ['Wi-Fi', 'Air conditioning', 'Heating', 'Private bathroom', 'Free toiletries', 'TV', 'Desk']
            .filter((a) => screen.queryByText(a));
        expect(drawn).toHaveLength(5);
        // no disclosure toggle on the amenities group
        expect(screen.queryByRole('button', { name: /view more/i })).not.toBeInTheDocument();
    });

    it('falls back to the flat amenities list when amenityGroups is absent', () => {
        render(<PropertyDescription tone="dark" amenities={['24 hour reception', 'Elevator']} />);
        expect(screen.getByText('General Amenities')).toBeInTheDocument();
        expect(screen.getByText('Elevator')).toBeInTheDocument();
    });

    it('renders nothing when there is no content at all', () => {
        const { container } = render(<PropertyDescription tone="dark" amenities={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
