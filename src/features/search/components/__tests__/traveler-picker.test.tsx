import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import { useSearchStore } from '@/shared/stores/search.store';
import { TravelerPicker } from '../traveler-picker';

/**
 * A child's age in the search bar's travellers: the site's dropdown in place of the browser's
 * `<select>`. Its options open at the top of the page, outside the travellers' box, and the box
 * closes on a click outside itself — so choosing an age must not count as one.
 */

const renderPicker = () =>
    render(
        <ThemeProvider>
            <NextIntlClientProvider locale="en" messages={en as never}>
                <TravelerPicker />
            </NextIntlClientProvider>
        </ThemeProvider>,
    );

beforeEach(() => {
    act(() => {
        useSearchStore.getState().setTravelers({ adults: 2, children: 1 });
        useSearchStore.getState().setActiveDropdown('travelers');
    });
});

describe('a child\'s age', () => {
    it('is chosen from the site\'s dropdown, and the travellers stay open while it is', () => {
        renderPicker();
        expect(document.querySelector('select')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Child 1 age: 10 yrs' }));
        const option = within(screen.getByRole('listbox')).getByRole('option', { name: '7 yrs' });
        // The box listens for mousedown outside itself; the option is outside it in the DOM.
        fireEvent.mouseDown(option);
        fireEvent.click(option);

        expect(useSearchStore.getState().activeDropdown).toBe('travelers');
        expect(screen.getByRole('button', { name: 'Child 1 age: 7 yrs' })).toBeInTheDocument();
    });

    it('still lets a click elsewhere on the page close the travellers', () => {
        renderPicker();
        fireEvent.mouseDown(document.body);
        expect(useSearchStore.getState().activeDropdown).toBeNull();
    });
});
