import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { ThemeProvider } from '@/shared/components/ThemeContext';
import { DEFAULT_FLIGHT_FILTERS, type FlightFilterState } from '../../lib/filter-offers';
import { FlightFilters } from '../flight-filters';
import { ROUND_TRIP } from './fixtures';

/**
 * The departure and arrival windows' times: the site's dropdown, not the browser's clock — whose
 * picker the system draws in its own colours, unlike every other control on the page.
 */

const renderFilters = (filters: Partial<FlightFilterState> = {}, onChange = vi.fn()) => {
    render(
        <ThemeProvider>
            <NextIntlClientProvider locale="en" messages={en as never}>
                <FlightFilters filters={{ ...DEFAULT_FLIGHT_FILTERS, ...filters }} onChange={onChange} allOffers={[ROUND_TRIP]} />
            </NextIntlClientProvider>
        </ThemeProvider>,
    );
    return onChange;
};

describe('the flight filters\' times', () => {
    it('are dropdowns, with no clock field for the browser to draw', () => {
        renderFilters();
        expect(document.querySelector('input[type="time"]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Departure from: 00:00' })).toHaveAttribute('aria-haspopup', 'listbox');
        expect(screen.getByRole('button', { name: 'Departure to: 23:59' })).toBeInTheDocument();
    });

    it('offer every half hour, and set the window from the one picked', () => {
        const onChange = renderFilters();
        fireEvent.click(screen.getByRole('button', { name: 'Departure from: 00:00' }));
        const list = screen.getByRole('listbox');
        expect(within(list).getByRole('option', { name: '08:30' })).toBeInTheDocument();
        fireEvent.click(within(list).getByRole('option', { name: '08:30' }));
        expect(onChange).toHaveBeenCalledWith({ departureWindow: [510, 1439] });
    });

    it('offer only times on their own side of the other end', () => {
        renderFilters({ departureWindow: [600, 900] });
        fireEvent.click(screen.getByRole('button', { name: 'Departure to: 15:00' }));
        const list = screen.getByRole('listbox');
        expect(within(list).queryByRole('option', { name: '09:30' })).not.toBeInTheDocument();
        expect(within(list).getByRole('option', { name: '10:00' })).toBeInTheDocument();
        expect(within(list).getByRole('option', { name: '23:59' })).toBeInTheDocument();
    });

    it('show a time the slider left between two half hours as the chosen one', () => {
        renderFilters({ arrivalWindow: [437, 1439] });
        fireEvent.click(screen.getByRole('button', { name: 'Arrival from: 07:17' }));
        expect(within(screen.getByRole('listbox')).getByRole('option', { name: '07:17' })).toHaveAttribute('aria-selected', 'true');
    });
});
