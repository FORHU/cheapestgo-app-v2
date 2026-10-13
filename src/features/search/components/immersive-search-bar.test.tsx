/**
 * Flights need an airport, not a city, so in flights mode the pickers offer airports —
 * code, city and airport name — where stays mode offers destination cards. A city card
 * picked for a flight used to become a bare name ("Kyoto") no flight search can resolve.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';

const autocompleteDestinations = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/api/destinations.api', () => ({ autocompleteDestinations }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ImmersiveSearchBar } from './immersive-search-bar';

const kix = { type: 'airport', title: 'Osaka (KIX)', subtitle: 'Kansai International Airport · Japan', code: 'KIX', countryCode: '' };

describe('ImmersiveSearchBar — flights pickers', () => {
    beforeEach(() => {
        autocompleteDestinations.mockReset();
        autocompleteDestinations.mockResolvedValue([kix]);
    });

    const openFlightsDestination = async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar />);
        await user.click(screen.getByRole('button', { name: 'Flights' }));
        await user.click(screen.getByText('somewhere amazing'));
        return user;
    };

    it('offers popular airports with their codes, not the stays city cards', async () => {
        await openFlightsDestination();

        expect(screen.getByText('Popular airports')).toBeInTheDocument();
        expect(screen.getByText('MNL')).toBeInTheDocument();
        expect(screen.getByText('Ninoy Aquino International Airport · Philippines')).toBeInTheDocument();
        expect(screen.queryByText('Indonesia · Island escape')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search cities, countries, anywhere…')).not.toBeInTheDocument();
    });

    it('picks a popular airport in one click, code and all', async () => {
        const user = await openFlightsDestination();
        await user.click(screen.getByText('MNL'));
        expect(screen.getByText('Manila (MNL)')).toBeInTheDocument();
    });

    it('lists typed results as airports with their codes', async () => {
        const user = await openFlightsDestination();
        await user.type(screen.getByRole('textbox'), 'Kyoto');

        await waitFor(() => expect(autocompleteDestinations).toHaveBeenCalledWith('Kyoto', 'flights'));
        expect(await screen.findByText('KIX')).toBeInTheDocument();
        expect(screen.getByText('Kansai International Airport · Japan')).toBeInTheDocument();

        await user.click(screen.getByText('KIX'));
        expect(screen.getByText('Osaka (KIX)')).toBeInTheDocument();
    });

    it('says so when nothing matches, rather than showing city cards', async () => {
        autocompleteDestinations.mockResolvedValue([]);
        const user = await openFlightsDestination();
        await user.type(screen.getByRole('textbox'), 'CRJ');

        expect(await screen.findByText('No airports match “CRJ”')).toBeInTheDocument();
        expect(screen.queryByText('Popular airports')).not.toBeInTheDocument();
    });
});
