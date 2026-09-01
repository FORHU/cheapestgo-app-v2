import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropertyDescription } from '@/features/hotels/components/property-description';

vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('PropertyDescription — amenities', () => {
    it('flattens ETG amenityGroups into the single "Amenities" group (no per-category headers)', () => {
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
        expect(screen.getByText('Amenities')).toBeInTheDocument();
        expect(screen.getByText('Free WiFi in all rooms')).toBeInTheDocument();
        expect(screen.getByText('Free private parking')).toBeInTheDocument();
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

    it('shows only the "General" ETG group, capped at five, with no "View more"', () => {
        render(
            <PropertyDescription
                tone="dark"
                amenities={[]}
                amenityGroups={[
                    {
                        groupName: 'General',
                        amenities: ['Elevator', 'Air conditioning', '24 hour reception', 'Safe', 'Terrace', 'Garden', 'Soundproofing'],
                        nonFree: [],
                    },
                    { groupName: 'Internet', amenities: ['Free Wi-Fi'], nonFree: [] },
                ]}
            />,
        );
        expect(screen.getByText('Elevator')).toBeInTheDocument();
        expect(screen.getByText('Terrace')).toBeInTheDocument();
        // 6th/7th General entries dropped, and the Internet group entirely
        expect(screen.queryByText('Garden')).not.toBeInTheDocument();
        expect(screen.queryByText('Soundproofing')).not.toBeInTheDocument();
        expect(screen.queryByText('Free Wi-Fi')).not.toBeInTheDocument();
        // no disclosure toggle on the amenities group
        expect(screen.queryByRole('button', { name: /view more/i })).not.toBeInTheDocument();
    });

    it('falls back to the flat amenities list when amenityGroups is absent', () => {
        render(<PropertyDescription tone="dark" amenities={['24 hour reception', 'Elevator']} />);
        expect(screen.getByText('Amenities')).toBeInTheDocument();
        expect(screen.getByText('Elevator')).toBeInTheDocument();
    });

    it('renders nothing when there is no content at all', () => {
        const { container } = render(<PropertyDescription tone="dark" amenities={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
