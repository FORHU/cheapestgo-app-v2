/**
 * Flights need an airport, not a city, so in flights mode the pickers offer airports —
 * code, city and airport name — where stays mode offers destination cards. A city card
 * picked for a flight used to become a bare name ("Kyoto") no flight search can resolve.
 */

import React, { Suspense, useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, withIntl } from '@/shared/testing/renderWithIntl';
import ko from '@/locales/ko.json';

const autocompleteDestinations = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/api/destinations.api', () => ({ autocompleteDestinations }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

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

    it('leaves the picked origin out of the destination suggestions', async () => {
        const mnl = { type: 'airport', title: 'Manila (MNL)', subtitle: 'Ninoy Aquino International Airport · Philippines', code: 'MNL', countryCode: '' };
        autocompleteDestinations.mockResolvedValue([mnl, kix]);
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar />);
        await user.click(screen.getByRole('button', { name: 'Flights' }));
        await user.click(screen.getByText('wherever you are'));
        await user.click(screen.getByText('MNL'));

        // Picking the origin moves straight on to the destination, popular airports first.
        expect(screen.getByText('Popular airports')).toBeInTheDocument();
        expect(screen.getByText('ICN')).toBeInTheDocument();
        expect(screen.queryByText('MNL')).not.toBeInTheDocument();

        await user.type(screen.getByRole('textbox'), 'Manila');
        expect(await screen.findByText('KIX')).toBeInTheDocument();
        expect(screen.queryByText('MNL')).not.toBeInTheDocument();
    });

    it('says so when nothing matches, rather than showing city cards', async () => {
        autocompleteDestinations.mockResolvedValue([]);
        const user = await openFlightsDestination();
        await user.type(screen.getByRole('textbox'), 'CRJ');

        expect(await screen.findByText('No airports match “CRJ”')).toBeInTheDocument();
        expect(screen.queryByText('Popular airports')).not.toBeInTheDocument();
    });
});

describe('ImmersiveSearchBar — onModeSelect', () => {
    it('hands the other tab to the caller instead of switching in place', async () => {
        const onModeSelect = vi.fn();
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="stays" onModeSelect={onModeSelect} />);

        await user.click(screen.getByRole('button', { name: 'Flights' }));

        expect(onModeSelect).toHaveBeenCalledExactlyOnceWith('flights');
        // Still the stays form: the caller moves the visitor, this bar does not reskin itself.
        expect(screen.queryByText('wherever you are')).not.toBeInTheDocument();
    });

    it('does nothing when the active tab is clicked', async () => {
        const onModeSelect = vi.fn();
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" onModeSelect={onModeSelect} />);

        await user.click(screen.getByRole('button', { name: 'Flights' }));

        expect(onModeSelect).not.toHaveBeenCalled();
    });
});

describe('ImmersiveSearchBar — a destination picked outside the bar', () => {
    it('fills the sentence and reports it back', () => {
        const onDestinationChange = vi.fn();
        const { rerender } = renderWithIntl(<ImmersiveSearchBar onDestinationChange={onDestinationChange} />);
        expect(onDestinationChange).toHaveBeenLastCalledWith(null);

        rerender(withIntl(<ImmersiveSearchBar destinationPick={{ name: 'Tokyo' }} onDestinationChange={onDestinationChange} />));

        expect(screen.getByText('Tokyo')).toBeInTheDocument();
        expect(screen.queryByText('somewhere amazing')).not.toBeInTheDocument();
        expect(onDestinationChange).toHaveBeenLastCalledWith('Tokyo');
    });
});

/**
 * GO used to show a spinner for a fixed 1.2s, then a green tick, then push — and the wait for the
 * results page itself showed nothing at all. The button now stays loading until the page arrives.
 */
describe('ImmersiveSearchBar — searching', () => {
    /** Never resolves, as a results page still on its way does not. */
    const pending = new Promise<never>(() => {});
    function ResultsPage(): never {
        throw pending;
    }

    /** The bar beside a stand-in for the router: a push mounts a page that has not arrived yet. */
    function Harness(props: React.ComponentProps<typeof ImmersiveSearchBar>) {
        const [href, setHref] = useState<string | null>(null);
        push.mockImplementation(setHref);
        return (
            <>
                <ImmersiveSearchBar {...props} />
                <Suspense fallback={null}>{href && <ResultsPage />}</Suspense>
            </>
        );
    }

    beforeEach(() => {
        push.mockReset();
        autocompleteDestinations.mockReset();
        autocompleteDestinations.mockResolvedValue([]);
    });

    it('stays loading from GO until the hotel results arrive', async () => {
        const user = userEvent.setup();
        renderWithIntl(<Harness destinationPick={{ name: 'Tokyo' }} />);

        await user.click(screen.getByRole('button', { name: 'GO' }));

        const button = screen.getByRole('button', { name: 'Searching hotels…' });
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(push).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^\/search\?destination=Tokyo&/));

        // A second press while it loads does not start a second search.
        await user.click(button);
        expect(push).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('GO')).not.toBeInTheDocument();
    });

    it('says it is searching flights on the flights tab', async () => {
        const user = userEvent.setup();
        renderWithIntl(<Harness defaultMode="flights" />);
        await user.click(screen.getByText('wherever you are'));
        await user.click(screen.getByText('MNL'));
        await user.click(screen.getByText('ICN'));

        await user.click(screen.getByRole('button', { name: 'GO' }));

        expect(screen.getByRole('button', { name: 'Searching flights…' })).toHaveAttribute('aria-busy', 'true');
        expect(push).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^\/flights\/search\?origin=Manila/));
    });

    it('does not search, or load, without a destination', async () => {
        const user = userEvent.setup();
        renderWithIntl(<Harness />);

        await user.click(screen.getByRole('button', { name: 'GO' }));

        expect(push).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'GO' })).toHaveAttribute('aria-busy', 'false');
    });
});

/**
 * The tabs, the stamp and the traveller panel are the parts of the bar that used to be English
 * in every language — the sentence around them was already translated, so a Korean visitor got a
 * Korean sentence between two English tabs and an English "GO".
 */
describe('ImmersiveSearchBar — in Korean', () => {
    const KO = { locale: 'ko', messages: ko };

    it('labels the tabs and the stamp in Korean', () => {
        renderWithIntl(<ImmersiveSearchBar />, KO);

        expect(screen.getByRole('button', { name: ko.landing.search.searchMode.stays })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: ko.landing.search.searchMode.flights })).toBeInTheDocument();
        expect(screen.getByText(ko.landing.search.go)).toBeInTheDocument();

        expect(screen.queryByRole('button', { name: 'Stays' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Flights' })).not.toBeInTheDocument();
        expect(screen.queryByText('GO')).not.toBeInTheDocument();
    });

    it('asks who is coming, and who is flying, in Korean', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar />, KO);

        await user.click(screen.getByText(ko.search.prose.ofUs.replace('{count}', '2')));
        expect(screen.getByText(ko.landing.search.whosComing)).toBeInTheDocument();
        expect(screen.getByText(ko.landing.search.adults)).toBeInTheDocument();
        expect(screen.getByText(ko.landing.search.children)).toBeInTheDocument();
        expect(screen.queryByText('Who\'s coming?')).not.toBeInTheDocument();
        expect(screen.queryByText('Adults')).not.toBeInTheDocument();
    });

    it('words the flights sentence in Korean before anything is picked', () => {
        // One way is the default, so the date slot asks for a single date.
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" />, KO);

        expect(screen.getByText(ko.search.prose.origin)).toBeInTheDocument();
        expect(screen.getByText(ko.search.prose.aDate)).toBeInTheDocument();
        expect(screen.queryByText('wherever you are')).not.toBeInTheDocument();
        expect(screen.queryByText('a date')).not.toBeInTheDocument();
    });

    it('words a round trip with no dates yet in Korean', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" />, KO);

        await user.click(screen.getByText(ko.search.prose.aDate));
        await user.click(screen.getByText(ko.search.roundTrip));

        expect(screen.getByText(ko.search.prose.yourDates)).toBeInTheDocument();
        expect(screen.queryByText('your dates')).not.toBeInTheDocument();
    });

    it('words flexible dates with no option chosen yet in Korean', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar />, KO);

        await user.click(screen.getByText(ko.search.prose.sometime));
        await user.click(screen.getByText(ko.search.imFlexible));

        expect(screen.getByText(ko.search.prose.flexibleTrip)).toBeInTheDocument();
        expect(screen.queryByText('a flexible trip')).not.toBeInTheDocument();
    });

    it('asks who is flying in Korean on the flights tab', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ImmersiveSearchBar defaultMode="flights" />, KO);

        await user.click(screen.getByText(ko.search.prose.ofUs.replace('{count}', '2')));
        expect(screen.getByText(ko.checkout.flight.whosFlying)).toBeInTheDocument();
        expect(screen.queryByText('Who\'s flying?')).not.toBeInTheDocument();
    });
});
