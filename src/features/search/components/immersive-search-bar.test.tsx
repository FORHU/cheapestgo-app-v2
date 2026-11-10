/**
 * The landing search bar: three tabs, and under them the search for the tab that is on. Stays
 * and Flights ask one question at a time (`step-search.tsx`, tested on its own); Golf keeps its
 * sentence. The tabs, and how a tab is handed to the Journey, are the bar's.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import ko from '@/locales/ko.json';

const autocompleteDestinations = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/api/destinations.api', () => ({ autocompleteDestinations }));
const fetchGolfCatalogue = vi.hoisted(() => vi.fn());
vi.mock('@/features/golf/api/golf.api', () => ({ fetchGolfCatalogue }));
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ push }),
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

import { ImmersiveSearchBar } from './immersive-search-bar';

describe('ImmersiveSearchBar — stays and flights, one question at a time', () => {
    beforeEach(() => {
        autocompleteDestinations.mockReset();
        autocompleteDestinations.mockResolvedValue([]);
    });

    it('asks where to stay on the Stays tab, with the cities it is handed as tiles', () => {
        renderWithIntl(<ImmersiveSearchBar stayPicks={[{ city: 'Bali', countryCode: 'ID', image: '/images/destinations/bali.webp' }]} />);

        expect(screen.getByRole('heading', { name: 'Where do you want to stay?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bali/ })).toBeInTheDocument();
        expect(screen.queryByText(/Find me a stay in/)).not.toBeInTheDocument();
    });

    it('asks what kind of trip it is first on the Flights tab', () => {
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" />);
        expect(screen.getByRole('heading', { name: 'What kind of trip is it?' })).toBeInTheDocument();
    });

    it('starts the flight search over when switched to in place', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar />);

        await user.click(screen.getByRole('button', { name: 'Flights' }));

        expect(screen.getByRole('heading', { name: 'What kind of trip is it?' })).toBeInTheDocument();
    });
});

describe('ImmersiveSearchBar — onModeSelect', () => {
    it('hands the other tab to the caller instead of switching in place', async () => {
        const onModeSelect = vi.fn();
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="stays" onModeSelect={onModeSelect} />);

        await user.click(screen.getByRole('button', { name: 'Flights' }));

        expect(onModeSelect).toHaveBeenCalledExactlyOnceWith('flights');
        // Still the stays search: the caller moves the visitor, this bar does not reskin itself.
        expect(screen.getByRole('heading', { name: 'Where do you want to stay?' })).toBeInTheDocument();
    });

    it('does nothing when the active tab is clicked', async () => {
        const onModeSelect = vi.fn();
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" onModeSelect={onModeSelect} />);

        await user.click(screen.getByRole('button', { name: 'Flights' }));

        expect(onModeSelect).not.toHaveBeenCalled();
    });
});

/**
 * The tabs were the part of the bar that used to stay English in every language; the search
 * under them is now the step flow's, asked in the page's language too.
 */
describe('ImmersiveSearchBar — in Korean', () => {
    const KO = { locale: 'ko', messages: ko };

    it('labels the tabs in Korean, and asks its first question in Korean', () => {
        renderWithIntl(<ImmersiveSearchBar />, KO);

        expect(screen.getByRole('button', { name: ko.landing.search.searchMode.stays })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: ko.landing.search.searchMode.flights })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: ko.search.steps.askStay })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Stays' })).not.toBeInTheDocument();
    });
});

describe('ImmersiveSearchBar — golf', () => {
    beforeEach(() => {
        fetchGolfCatalogue.mockReset();
        fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: [] });
    });

    it('makes Golf a third tab like the others, reported to the Journey rather than followed', async () => {
        const onModeSelect = vi.fn();
        renderWithIntl(<ImmersiveSearchBar onModeSelect={onModeSelect} />);
        expect(screen.queryByRole('link', { name: 'Golf' })).toBeNull();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Golf' }));
        expect(onModeSelect).toHaveBeenCalledWith('golf');
    });

    it('opens on the golf sentence, with the courses it is handed', () => {
        renderWithIntl(<ImmersiveSearchBar defaultMode="golf" golfCourses={[]} />);
        expect(screen.getByText(/Tee off at/)).toBeInTheDocument();
        expect(screen.getByText('the course')).toBeInTheDocument();
        expect(screen.queryByText(/Find me a stay in/)).not.toBeInTheDocument();
        expect(fetchGolfCatalogue).not.toHaveBeenCalled();
    });

    it('switched to golf in place, asks for the catalogue itself, since nobody handed it one', async () => {
        renderWithIntl(<ImmersiveSearchBar />);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Golf' }));
        expect(screen.getByText('the course')).toBeInTheDocument();
        await waitFor(() => expect(fetchGolfCatalogue).toHaveBeenCalledTimes(1));
    });
});
