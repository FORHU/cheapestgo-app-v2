/**
 * The landing search, one question at a time (Claude Design, "Search Step by Step" and
 * "Flight Search Step by Step"): where, then when, then who — and for a flight, the kind of trip
 * first, then from and to, with the origin already filled in so that step is a single tap.
 */
import React, { Suspense, useState } from 'react';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { useSearchStore } from '@/shared/stores/search.store';
import ko from '@/locales/ko.json';

const autocompleteDestinations = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/api/destinations.api', () => ({ autocompleteDestinations }));
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ push }),
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

import { StepSearch, type StayPick } from '../step-search';

const PICKS: StayPick[] = [
    { city: 'Seoul', countryCode: 'KR', image: '/images/destinations/seoul.webp', price: 'from ₩98,000' },
    { city: 'Tokyo', countryCode: 'JP', image: '/images/destinations/tokyo.webp' },
];

const icn = { type: 'airport', title: 'Seoul (ICN)', subtitle: 'Incheon International Airport · South Korea', code: 'ICN', countryCode: 'KR' };
const gmp = { type: 'airport', title: 'Seoul (GMP)', subtitle: 'Gimpo International Airport · South Korea', code: 'GMP', countryCode: 'KR' };
const seoulCity = { type: 'city', title: 'Seoul', subtitle: 'South Korea', countryCode: 'KR', lat: 37.56, lng: 126.97 };
const seogwipo = { type: 'city', title: 'Seogwipo', subtitle: 'Jeju, South Korea', countryCode: 'KR' };

/** The question on screen: the step's own heading. */
const question = () => screen.getByRole('heading', { level: 3 }).textContent;
/** A step in the indicator, by its label. */
const step = (name: string) => within(screen.getByRole('navigation', { name: 'Search steps' })).getByRole('button', { name: new RegExp(name) });
/** The href the search went to, read back as its path and parameters. */
const searched = () => {
    const [path, qs = ''] = String(push.mock.calls[0][0]).split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(qs)) };
};
/** Picks a day in the calendar on show, moving on a month first if asked. */
async function pickDay(user: ReturnType<typeof userEvent.setup>, day: number) {
    await user.click(screen.getByText(String(day), { selector: '[data-day]' }));
}

beforeEach(() => {
    // The calendar opens on the month of "today"; only the clock is faked, so typing still waits.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 0));
    push.mockReset();
    autocompleteDestinations.mockReset();
    autocompleteDestinations.mockResolvedValue([]);
    useSearchStore.setState((s) => ({ flightState: { ...s.flightState, flights: s.flightState.flights.map((f) => ({ ...f, origin: null })) } }));
});
afterEach(() => vi.useRealTimers());

describe('stays — where, then when, then who', () => {
    it('asks where first, and offers the showcase cities as picture tiles', () => {
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);

        expect(question()).toBe('Where do you want to stay?');
        expect(step('Where')).toHaveAttribute('aria-current', 'step');
        expect(screen.getByPlaceholderText('City, area, or hotel name')).toBeInTheDocument();
        expect(screen.getByText('Or pick one')).toBeInTheDocument();
        const seoul = screen.getByRole('button', { name: /Seoul/ });
        expect(within(seoul).getByText('South Korea')).toBeInTheDocument();
        expect(within(seoul).getByText('from ₩98,000')).toBeInTheDocument();
    });

    it('picks a city from its tile, says so, and moves on to the dates on Next', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);

        await user.click(screen.getByRole('button', { name: /Seoul/ }));

        expect(screen.getByRole('button', { name: /Seoul/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Seoul selected')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        expect(question()).toBe('When are you staying?');
        expect(step('When')).toHaveAttribute('aria-current', 'step');
    });

    it('does not move on without somewhere to stay', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);

        await user.click(screen.getByRole('button', { name: 'Next: dates' }));

        expect(question()).toBe('Where do you want to stay?');
        expect(screen.getByPlaceholderText('City, area, or hotel name')).toHaveFocus();
    });

    it('lists places as they are typed, and Enter picks the highlighted one', async () => {
        autocompleteDestinations.mockResolvedValue([seoulCity, seogwipo]);
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);

        await user.type(screen.getByPlaceholderText('City, area, or hotel name'), 'Seo');
        await screen.findByRole('option', { name: /Seogwipo/ });
        expect(autocompleteDestinations).toHaveBeenLastCalledWith('Seo', 'hotels');
        // The tiles give way to the list while there is something typed.
        expect(screen.queryByText('Or pick one')).not.toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Seoul/ })).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{ArrowDown}{Enter}');

        expect(screen.getByPlaceholderText('City, area, or hotel name')).toHaveValue('Seogwipo');
        expect(screen.getByText('Seogwipo selected')).toBeInTheDocument();
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('goes back to a finished step from the indicator', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        await user.click(screen.getByRole('button', { name: /Tokyo/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));

        await user.click(step('Where'));

        expect(question()).toBe('Where do you want to stay?');
        expect(screen.getByRole('button', { name: /Tokyo/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('searches the city on the days picked — local days, not UTC ones — for the guests counted', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        await user.click(screen.getByRole('button', { name: /Seoul/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));

        await user.click(screen.getByRole('button', { name: 'Next month' }));
        await pickDay(user, 12);
        await pickDay(user, 15);
        expect(screen.getByText(/3 nights/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Next: guests' }));

        expect(question()).toBe('Who\'s coming?');
        await user.click(screen.getByRole('button', { name: 'More adults' }));
        await user.click(screen.getByRole('button', { name: 'Search stays' }));

        expect(searched()).toEqual({
            path: '/search',
            params: { destination: 'Seoul', checkIn: '2026-12-12', checkOut: '2026-12-15', adults: '3', children: '0', rooms: '1' },
        });
    });

    it('lets the dates be skipped, and searches without them', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        await user.click(screen.getByRole('button', { name: /Seoul/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        expect(screen.getByText(/skip it and we'll pick dates/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next: guests' }));
        await user.click(screen.getByRole('button', { name: 'Search stays' }));

        expect(searched().params).toEqual({ destination: 'Seoul', adults: '2', children: '0', rooms: '1' });
    });

    it('carries a typed place\'s position, so the results map opens on it', async () => {
        autocompleteDestinations.mockResolvedValue([seoulCity]);
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        await user.type(screen.getByPlaceholderText('City, area, or hotel name'), 'Seo');
        await user.click(await screen.findByRole('option', { name: /Seoul/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next: guests' }));
        await user.click(screen.getByRole('button', { name: 'Search stays' }));

        expect(searched().params).toMatchObject({ destination: 'Seoul', lat: '37.56', lng: '126.97' });
    });
});

describe('flights — trip, from, to, when, who', () => {
    type User = ReturnType<typeof userEvent.setup>;
    /** Chooses the kind of trip, then takes the origin as it is offered: to the destination step. */
    async function toDestination(user: User, trip: 'One-way' | 'Round-trip' = 'One-way') {
        await user.click(screen.getByRole('button', { name: new RegExp(`^${trip}`) }));
        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        await user.click(screen.getByRole('button', { name: 'Next: destination' }));
    }

    it('asks first what kind of trip it is, with neither chosen yet', () => {
        renderWithIntl(<StepSearch mode="flights" />);

        expect(question()).toBe('What kind of trip is it?');
        expect(step('Trip')).toHaveAttribute('aria-current', 'step');
        expect(screen.getByRole('button', { name: /^One-way/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /^Round-trip/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not move on until a kind of trip is chosen', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);

        await user.click(screen.getByRole('button', { name: 'Next: departure' }));

        expect(question()).toBe('What kind of trip is it?');
    });

    it("picks round-trip, says so, and moves on to where from — the airport for the page's language already in", async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);

        await user.click(screen.getByRole('button', { name: /^Round-trip/ }));
        expect(screen.getByRole('button', { name: /^Round-trip/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Round-trip selected')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        expect(question()).toBe('Where are you flying from?');
        expect(step('From')).toHaveAttribute('aria-current', 'step');
        expect(screen.getByPlaceholderText('Search cities, airports…')).toHaveValue('Manila (MNL)');
        // Already answered, so the field does not take the focus — no keyboard pops up on a phone.
        expect(screen.getByPlaceholderText('Search cities, airports…')).not.toHaveFocus();
    });

    it('starts a Korean visitor from Incheon', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />, { locale: 'ko', messages: ko });
        await user.click(screen.getByRole('button', { name: new RegExp(`^${ko.search.oneWay}`) }));
        await user.click(screen.getByRole('button', { name: ko.search.steps.nextOrigin }));
        expect(screen.getByRole('combobox')).toHaveValue('Seoul (ICN)');
    });

    it('starts from the airport searched from last time', async () => {
        useSearchStore.setState((s) => ({
            flightState: { ...s.flightState, flights: s.flightState.flights.map((f, i) => (i === 0 ? { ...f, origin: { title: 'Clark (CRK)', subtitle: '', type: 'city', countryCode: '' } } : f)) },
        }));
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user);
        expect(screen.getByText('CRK')).toBeInTheDocument();
        expect(screen.getByText('From Clark')).toBeInTheDocument();
    });

    it('goes back to the origin on Change, ready to type', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user);

        await user.click(screen.getByRole('button', { name: 'Change' }));

        expect(question()).toBe('Where are you flying from?');
        expect(screen.getByPlaceholderText('Search cities, airports…')).toHaveFocus();
    });

    it('offers popular airports before anything is typed — but not the one being flown from', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user);
        const list = screen.getByRole('listbox');
        expect(within(list).getByText('ICN')).toBeInTheDocument();
        expect(within(list).queryByText('MNL')).not.toBeInTheDocument();
    });

    it('lists typed airports with their codes, and Enter picks the highlighted airport', async () => {
        autocompleteDestinations.mockResolvedValue([icn, gmp]);
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user);

        await user.type(screen.getByPlaceholderText('Search cities, airports…'), 'Seo');
        await screen.findByRole('option', { name: /GMP/ });
        expect(autocompleteDestinations).toHaveBeenLastCalledWith('Seo', 'flights');
        expect(screen.getByText('Press Enter to pick the highlighted airport')).toBeInTheDocument();

        await user.keyboard('{Enter}');

        expect(screen.getByPlaceholderText('Search cities, airports…')).toHaveValue('Seoul (ICN)');
        expect(screen.getByText('Seoul (ICN) selected')).toBeInTheDocument();
    });

    it('searches one way on the day picked', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user, 'One-way');
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /ICN/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));

        expect(question()).toBe('When are you flying?');
        await user.click(screen.getByRole('button', { name: 'Next month' }));
        await pickDay(user, 12);
        await user.click(screen.getByRole('button', { name: 'Next: travellers' }));

        expect(question()).toBe("Who's flying?");
        await user.click(screen.getByRole('button', { name: 'Search flights' }));

        expect(searched()).toEqual({
            path: '/flights/search',
            params: {
                origin: 'Manila (MNL)', destination: 'Seoul (ICN)', depart: '2026-12-12',
                tripType: 'one-way', cabin: 'economy', adults: '2', children: '0', infants: '0',
            },
        });
    });

    it('asks for the return too on a round trip — chosen up front, not again on the dates', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await toDestination(user, 'Round-trip');
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /ICN/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));

        expect(screen.queryByRole('button', { name: /^Round-trip/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Next month' }));
        await pickDay(user, 12);
        await pickDay(user, 19);
        await user.click(screen.getByRole('button', { name: 'Next: travellers' }));
        await user.click(screen.getByRole('button', { name: 'Search flights' }));

        expect(searched().params).toMatchObject({ depart: '2026-12-12', return: '2026-12-19', tripType: 'round-trip' });
    });

    it('does not fly somewhere from itself', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await user.click(screen.getByRole('button', { name: /^One-way/ }));
        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /ICN/ }));
        await user.click(screen.getByRole('button', { name: 'Next: destination' }));

        expect(question()).toBe('Where are you flying to?');
        expect(screen.getByText('From Seoul')).toBeInTheDocument();
        expect(within(screen.getByRole('listbox')).queryByText('ICN')).not.toBeInTheDocument();
    });
});

/** Every step after the first has a Back button under it, to the step before, answers kept. */
describe('back', () => {
    const back = () => screen.getByRole('button', { name: 'Back' });

    it('has none on the first step of a flight — there is nowhere to go back to', () => {
        renderWithIntl(<StepSearch mode="flights" />);
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('has none on the first step of a stay either', () => {
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('walks a flight back one step at a time, keeping every answer', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await user.click(screen.getByRole('button', { name: /^Round-trip/ }));
        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        await user.click(screen.getByRole('button', { name: 'Next: destination' }));
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /ICN/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next: travellers' }));
        expect(question()).toBe("Who's flying?");

        await user.click(back());
        expect(question()).toBe('When are you flying?');
        await user.click(back());
        expect(question()).toBe('Where are you flying to?');
        expect(screen.getByPlaceholderText('Search cities, airports…')).toHaveValue('Seoul (ICN)');
        await user.click(back());
        expect(question()).toBe('Where are you flying from?');
        expect(screen.getByPlaceholderText('Search cities, airports…')).toHaveValue('Manila (MNL)');
        await user.click(back());
        expect(question()).toBe('What kind of trip is it?');
        expect(screen.getByRole('button', { name: /^Round-trip/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('lets a changed trip type ask for one date instead of two', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="flights" />);
        await user.click(screen.getByRole('button', { name: /^Round-trip/ }));
        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        await user.click(screen.getByRole('button', { name: 'Next: destination' }));
        await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /ICN/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next month' }));
        await pickDay(user, 12);
        await pickDay(user, 19);

        // Back to the start, and one way instead.
        for (let i = 0; i < 3; i++) await user.click(back());
        await user.click(screen.getByRole('button', { name: /^One-way/ }));
        await user.click(screen.getByRole('button', { name: 'Next: departure' }));
        await user.click(screen.getByRole('button', { name: 'Next: destination' }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next: travellers' }));
        await user.click(screen.getByRole('button', { name: 'Search flights' }));

        expect(searched().params.tripType).toBe('one-way');
        expect(searched().params).not.toHaveProperty('return');
    });

    it('walks a stay back from the guests to where, keeping the city', async () => {
        const user = userEvent.setup();
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
        await user.click(screen.getByRole('button', { name: /Tokyo/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next: guests' }));

        await user.click(back());
        expect(question()).toBe('When are you staying?');
        await user.click(back());
        expect(question()).toBe('Where do you want to stay?');
        expect(screen.getByRole('button', { name: /Tokyo/ })).toHaveAttribute('aria-pressed', 'true');
    });
});

/**
 * The search runs in a transition, so the last button stays loading until the results page has
 * arrived — the same promise the sentence's GO kept.
 */
describe('searching', () => {
    const pending = new Promise<never>(() => {});
    function ResultsPage(): never {
        throw pending;
    }
    function Harness(props: React.ComponentProps<typeof StepSearch>) {
        const [href, setHref] = useState<string | null>(null);
        push.mockImplementation(setHref);
        return (
            <>
                <StepSearch {...props} />
                <Suspense fallback={null}>{href && <ResultsPage />}</Suspense>
            </>
        );
    }

    it('stays loading until the hotel results arrive, and does not search twice', async () => {
        const user = userEvent.setup();
        renderWithIntl(<Harness mode="stays" picks={PICKS} />);
        await user.click(screen.getByRole('button', { name: /Seoul/ }));
        await user.click(screen.getByRole('button', { name: 'Next: dates' }));
        await user.click(screen.getByRole('button', { name: 'Next: guests' }));

        await user.click(screen.getByRole('button', { name: 'Search stays' }));

        const button = screen.getByRole('button', { name: 'Searching hotels…' });
        expect(button).toHaveAttribute('aria-busy', 'true');
        await user.click(button);
        expect(push).toHaveBeenCalledTimes(1);
    });
});

describe('in Korean', () => {
    it('asks its questions and labels its steps in Korean', async () => {
        renderWithIntl(<StepSearch mode="stays" picks={PICKS} />, { locale: 'ko', messages: ko });

        expect(question()).toBe(ko.search.steps.askStay);
        expect(within(screen.getByRole('navigation', { name: ko.search.steps.navLabel })).getByText(ko.search.steps.where)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: ko.search.steps.nextDates })).toBeInTheDocument();
        expect(screen.queryByText('Where do you want to stay?')).not.toBeInTheDocument();
        await act(async () => {});
    });
});

it('waits for typing to settle before asking for suggestions', async () => {
    const user = userEvent.setup();
    renderWithIntl(<StepSearch mode="stays" picks={PICKS} />);
    await user.type(screen.getByPlaceholderText('City, area, or hotel name'), 'Seoul');
    await waitFor(() => expect(autocompleteDestinations).toHaveBeenCalledTimes(1));
    expect(autocompleteDestinations).toHaveBeenCalledWith('Seoul', 'hotels');
});
