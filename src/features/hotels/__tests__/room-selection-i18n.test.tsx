import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { RoomSelection } from '@/features/hotels/components/room-selection';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import type { RoomOption } from '@/features/hotels/types/property.types';

/**
 * The room list reads its words from the messages, in the language being served.
 *
 * Checked by rendering rather than by comparing JSON: a key can exist in all four languages
 * and still never reach the screen, which is exactly the state this pass is undoing. The page
 * itself fetches before it draws, so a server-rendered HTML check sees only the skeleton —
 * this is the level at which the wiring is observable.
 */

const room: RoomOption = {
    id:       'r1',
    name:     'Comfort Leisure Room',
    price:    169,
    currency: 'USD',
};

const renderIn = (locale: 'en' | 'ko') => render(
    <ThemeProvider>
        <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? ko : en}>
            <RoomSelection
                rooms={[room]}
                tone="dark"
                currency="USD"
                selectedOfferId={null}
                onSelect={() => {}}
            />
        </NextIntlClientProvider>
    </ThemeProvider>,
);

describe('RoomSelection in each language', () => {
    it('heads the list in English for the English storefront', () => {
        renderIn('en');

        expect(screen.getByText(en.property.v2.availableRooms)).toBeInTheDocument();
    });

    it('heads the list in Korean for the Korean storefront', () => {
        renderIn('ko');

        expect(screen.getByText(ko.property.v2.availableRooms)).toBeInTheDocument();
        // The point of the exercise: the English is gone, not merely joined.
        expect(screen.queryByText(en.property.v2.availableRooms)).toBeNull();
    });

    it('uses a Korean heading that is actually Korean', () => {
        // A key copied across but left in English would pass the test above.
        expect(ko.property.v2.availableRooms).toMatch(/[가-힣]/);
    });
});
