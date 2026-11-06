/**
 * v1's FAQ on the v2 property page: questions built from the hotel's own data, each opening in
 * place, with three general ones only for a hotel the supplier told us nothing about.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { PropertyFaq, propertyFaqs } from '@/features/hotels/components/property-faq';

describe('propertyFaqs', () => {
    it('asks only what the hotel can answer, in v1 order', () => {
        const faqs = propertyFaqs({
            checkInTime: '14:00',
            checkOutTime: '12:00',
            facilities: ['Free WiFi', 'Free private parking', 'Swimming Pool', 'Restaurant'],
            importantInfo: 'Photo ID is required at check-in.',
        });
        expect(faqs.map(f => f.key)).toEqual(['checkIn', 'checkOut', 'parking', 'wifi', 'pool', 'restaurant', 'important']);
        // The hour as the description shows it, and the facility as the hotel words it.
        expect(faqs[0].values).toEqual({ time: '2:00 PM' });
        expect(faqs[2].values).toEqual({ facility: 'free private parking' });
        expect(faqs[6].verbatim).toBe('Photo ID is required at check-in.');
    });

    it('leaves out what is missing rather than answering it vaguely', () => {
        const faqs = propertyFaqs({ checkInTime: '15:00', facilities: ['Spa'] });
        expect(faqs.map(f => f.key)).toEqual(['checkIn']);
    });

    it('falls back to the three general questions only when there is nothing specific', () => {
        expect(propertyFaqs({ facilities: [], importantInfo: '  ' }).map(f => f.key))
            .toEqual(['fallbackCancellation', 'fallbackPayment', 'fallbackModification']);
    });
});

describe('PropertyFaq', () => {
    it('names the hotel and opens an answer in place', async () => {
        const user = userEvent.setup();
        renderWithIntl(
            <PropertyFaq tone="light" propertyName="Bayside Grand Manila" checkInTime="14:00" facilities={['Free WiFi']} />,
        );

        expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
        const wifi = screen.getByRole('button', { name: 'Is WiFi available at Bayside Grand Manila?' });
        expect(wifi).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Yes, WiFi is available at the property.')).not.toBeInTheDocument();

        await user.click(wifi);

        expect(wifi).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('region', { name: 'Is WiFi available at Bayside Grand Manila?' }))
            .toHaveTextContent('Yes, WiFi is available at the property.');
    });

    it('answers check-in with the formatted hour', async () => {
        const user = userEvent.setup();
        renderWithIntl(<PropertyFaq tone="dark" propertyName="Hotel" checkInTime="14:00" facilities={[]} />);
        await user.click(screen.getByRole('button', { name: 'What time is check-in at this property?' }));
        expect(screen.getByText('Check-in time is 2:00 PM')).toBeInTheDocument();
    });
});
