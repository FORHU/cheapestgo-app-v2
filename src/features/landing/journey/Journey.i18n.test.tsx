import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, withIntl } from '@/shared/testing/renderWithIntl';
import { GOLF_FACE } from '@/features/golf/lib/last-search';
import { formatCurrency } from '@/shared/lib/format';
import { convertCurrency, getCurrencySymbol } from '@/shared/lib/currency';
import { useSearchStore } from '@/shared/stores/search.store';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';

/**
 * The Journey speaks the visitor's language.
 *
 * Its hero, every stage's heading and caption, the stay strip, the closing cards and the
 * altitude readout were English literals, so the language selector translated the header and
 * footer around a page that stayed English. These render it against the real message files.
 */

const progress = vi.hoisted(() => ({ journey: 0, reduced: false }));

vi.mock('./useJourneyProgress', () => ({
    useJourneyProgress: () => ({ journey: progress.journey, trackPx: 4000, reducedMotion: progress.reduced }),
}));
const snap = vi.hoisted(() => ({ goToStop: vi.fn() }));
vi.mock('./useSectionSnap', () => ({ useSectionSnap: () => snap.goToStop }));
vi.mock('./StageShowcase', () => ({ StageShowcase: () => null }));
vi.mock('./HeroBackdrop', () => ({ HeroBackdrop: () => null }));
// The search bars are covered by their own tests; here they only need to exist, and to show
// what the page hands them.
const bar = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@/features/search/components/immersive-search-bar', () => ({
    ImmersiveSearchBar: (props: Record<string, unknown>) => { bar.props = props; return null; },
}));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
        <a href={href} {...rest}>{children}</a>,
}));
// The Golf face asks for the catalogue when it is first shown.
const golfApi = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => golfApi);

import { Journey } from './Journey';
import { JOURNEY_STOPS, STAGES, STAGE_DOCK } from './stages';

const stay = {
    hotelCode: 'h1', name: 'Hotel', location: null, city: 'Seoul', countryCode: 'KR', price: 120, currency: 'USD',
    stars: null, rating: null, badge: null, images: [], lat: null, lng: null, refreshedAt: null,
};
const showcaseStays = { Seoul: stay };

const KO = { locale: 'ko', messages: ko };
const J_EN = en.landing.journey;
const J_KO = ko.landing.journey;

/** The stage mid-way through its dock: settled, nothing arriving or leaving. */
const STAYS_DOCKED = 0.25;
const OPTIONS_DOCKED = 0.9;

beforeEach(() => {
    progress.journey = 0;
    progress.reduced = false;
    snap.goToStop.mockReset();
    golfApi.fetchGolfCatalogue.mockReset();
    golfApi.fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: [] });
});

describe('Journey hero', () => {
    it('is in Korean at /ko, with none of the English left', () => {
        renderWithIntl(<Journey showcaseStays={{}} />, KO);

        expect(screen.getByText(J_KO.hero.kicker)).toBeInTheDocument();
        expect(screen.getByText(J_KO.hero.titleLine1)).toBeInTheDocument();
        expect(screen.getByText(J_KO.hero.titleLine2)).toBeInTheDocument();
        expect(screen.getByText(J_KO.hero.subtitle)).toBeInTheDocument();
        expect(screen.getByText(J_KO.hero.scrollCue)).toBeInTheDocument();

        expect(screen.queryByText('One search.')).not.toBeInTheDocument();
        expect(screen.queryByText('Scroll down to explore')).not.toBeInTheDocument();
    });

    it('is unchanged in English', () => {
        renderWithIntl(<Journey showcaseStays={{}} />);

        expect(screen.getByText('Hotels · Flights · Golf')).toBeInTheDocument();
        expect(screen.getByText('One search.')).toBeInTheDocument();
        expect(screen.getByText('Every way to go.')).toBeInTheDocument();
        expect(screen.getByText('Skip the surprise fees. Chase the sunsets.')).toBeInTheDocument();
        expect(screen.getByText('Scroll down to explore')).toBeInTheDocument();
    });
});

describe('Journey stages', () => {
    it('writes the hotels stage in Korean — heading and caption', () => {
        progress.journey = STAYS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />, KO);

        const s = J_KO.stages.stays;
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(`${s.titleLead} ${s.titleRest}`);
        expect(screen.getByText(s.caption)).toBeInTheDocument();

        expect(screen.queryByText(J_EN.stages.stays.caption)).not.toBeInTheDocument();
    });

    it('keeps the English heading, with no numbered stage label above it', () => {
        progress.journey = STAYS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />);

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Find your stay.');
        expect(screen.queryByText(/STAGE \d/)).not.toBeInTheDocument();
    });

    it('keeps the closing stage\'s eyebrow', () => {
        progress.journey = OPTIONS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />, KO);

        expect(screen.getByText(J_KO.stages.options.eyebrow)).toBeInTheDocument();
    });

    it('says "from" in the visitor\'s language on the stay strip', () => {
        progress.journey = STAYS_DOCKED;
        act(() => useSearchStore.setState({ userCurrency: 'USD' }));
        renderWithIntl(<Journey showcaseStays={showcaseStays} />, KO);

        const price = formatCurrency(stay.price, stay.currency);
        expect(screen.getByText(J_KO.strip.from.replace('{price}', price))).toBeInTheDocument();
        expect(screen.queryByText(`from ${price}`)).not.toBeInTheDocument();
    });

    it('prices the stay strip in the currency picked in the header, as every other price on the page is', () => {
        progress.journey = STAYS_DOCKED;
        act(() => useSearchStore.setState({ userCurrency: 'KRW' }));
        renderWithIntl(<Journey showcaseStays={showcaseStays} />);

        // `useMoney`'s figure, from the same conversion the landing cards use.
        const won = `${getCurrencySymbol('KRW')}${Math.round(convertCurrency(stay.price, 'USD', 'KRW')).toLocaleString('en-US')}`;
        expect(screen.getByText(J_EN.strip.from.replace('{price}', won))).toBeInTheDocument();
        expect(screen.queryByText(J_EN.strip.from.replace('{price}', '$120'))).not.toBeInTheDocument();
    });

    it('hands a picked city to the stay search, and lights the one the search holds', () => {
        progress.journey = STAYS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />);
        const tokyo = () => screen.getByRole('button', { name: 'Tokyo' });

        fireEvent.click(tokyo());
        expect(bar.props.destinationPick).toEqual({ name: 'Tokyo' });

        // Lit by what the search's sentence holds, not by the click: the bar reports it back.
        expect(tokyo()).toHaveAttribute('aria-pressed', 'false');
        act(() => (bar.props.onDestinationChange as (name: string | null) => void)('Tokyo'));
        expect(tokyo()).toHaveAttribute('aria-pressed', 'true');

        // A city picked from the dropdown instead puts the pill out again.
        act(() => (bar.props.onDestinationChange as (name: string | null) => void)('Paris'));
        expect(tokyo()).toHaveAttribute('aria-pressed', 'false');
    });

    it('translates the closing cards, Golf included', () => {
        progress.journey = OPTIONS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />, KO);

        expect(screen.getByRole('heading', { level: 2 }).textContent)
            .toBe(`${J_KO.stages.options.titleLead} ${J_KO.stages.options.titleRest}`);

        const stays = screen.getByRole('link', { name: new RegExp(ko.landing.search.searchMode.stays) });
        expect(within(stays).getByText(J_KO.options.staysNote)).toBeInTheDocument();
        const flights = screen.getByRole('link', { name: new RegExp(ko.landing.search.searchMode.flights) });
        expect(within(flights).getByText(J_KO.options.flightsNote)).toBeInTheDocument();

        const golf = screen.getByRole('link', { name: new RegExp(J_KO.options.golf) });
        expect(golf).toHaveAttribute('href', '/golf');
        expect(screen.getByText(J_KO.options.golfNote)).toBeInTheDocument();
        expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
        expect(screen.queryByText('Hotels & homes')).not.toBeInTheDocument();
    });

    it('switches language when the locale does — the same page, rendered in Japanese', () => {
        progress.journey = OPTIONS_DOCKED;
        renderWithIntl(<Journey showcaseStays={{}} />, { locale: 'ja', messages: ja });

        expect(screen.getByText(ja.landing.journey.options.golf)).toBeInTheDocument();
        expect(screen.queryByText(J_KO.options.golf)).not.toBeInTheDocument();
        expect(screen.queryByText('Golf')).not.toBeInTheDocument();
    });
});

describe('Journey without motion', () => {
    it('states every stage in Korean, in order', () => {
        progress.reduced = true;
        renderWithIntl(<Journey showcaseStays={{}} />, KO);

        const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
        expect(headings).toEqual([
            `${J_KO.stages.stays.titleLead} ${J_KO.stages.stays.titleRest}`,
            `${J_KO.stages.flights.titleLead} ${J_KO.stages.flights.titleRest}`,
            `${J_KO.stages.golf.titleLead} ${J_KO.stages.golf.titleRest}`,
            `${J_KO.stages.options.titleLead} ${J_KO.stages.options.titleRest}`,
        ]);
        expect(screen.queryByText('Find your stay.')).not.toBeInTheDocument();
    });
});

describe('Journey golf face', () => {
    const course = {
        id: 'c1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
        description: '', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW', imageUrls: [], amenities: [],
        status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 48, scheduleCount: 1, bookable: true,
    };
    const more = ['b', 'c', 'd', 'e'].map((id) => ({ ...course, id, slug: `course-${id}`, name: `Course ${id.toUpperCase()}`, greenFeeFrom: null }));

    const toGolf = async () => {
        progress.journey = STAYS_DOCKED;
        useSearchStore.setState({ userCurrency: 'KRW' });
        const view = renderWithIntl(<Journey showcaseStays={{}} />);
        act(() => { (bar.props.onModeSelect as (m: string) => void)('golf'); });
        // The old face fades out before the new one is put in its place.
        await screen.findByText(J_EN.stages.golf.caption);
        return view;
    };

    it('slides in place to golf, whose bar opens on golf with the catalogue in the visitor\'s currency', async () => {
        golfApi.fetchGolfCatalogue.mockResolvedValue({ courses: [course], countries: ['Philippines'] });
        await toGolf();

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(`${J_EN.stages.golf.titleLead} ${J_EN.stages.golf.titleRest}`);
        expect(bar.props.defaultMode).toBe('golf');
        expect(golfApi.fetchGolfCatalogue).toHaveBeenCalledWith({ currency: 'KRW' });
        await screen.findByRole('button', { name: /Wack Wack/ });
        expect(bar.props.golfCourses).toEqual([course]);
    });

    it('names four courses under the search, priced as api-v2 sent them, and the way to the rest', async () => {
        golfApi.fetchGolfCatalogue.mockResolvedValue({ courses: [course, ...more], countries: [] });
        await toGolf();

        const wack = await screen.findByRole('button', { name: /Wack Wack/ });
        expect(within(wack).getByText(`from ${formatCurrency(120000, 'KRW')}`)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Course D' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Course E' })).toBeNull();
        expect(screen.getByRole('link', { name: en.search.golf.allCourses })).toHaveAttribute('href', '/golf');
    });

    it('hands a picked course to the sentence, and lights the pill the sentence holds', async () => {
        golfApi.fetchGolfCatalogue.mockResolvedValue({ courses: [course], countries: [] });
        await toGolf();

        fireEvent.click(await screen.findByRole('button', { name: /Wack Wack/ }));
        expect(bar.props.coursePick).toEqual({ slug: 'wack-wack' });
        act(() => { (bar.props.onCourseChange as (s: string | null) => void)('wack-wack'); });
        expect(screen.getByRole('button', { name: /Wack Wack/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('draws no pills when there are no courses', async () => {
        await toGolf();
        await waitFor(() => expect(bar.props.golfCourses).toEqual([]));
        expect(screen.queryByRole('link', { name: en.search.golf.allCourses })).toBeNull();
    });
});

describe('Journey, coming back from a golf course', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
        scrollIntoView.mockReset();
        Element.prototype.scrollIntoView = scrollIntoView;
        window.history.replaceState(null, '', GOLF_FACE);
    });
    afterEach(() => window.history.replaceState(null, '', '/'));

    it('docks on the search with its Golf face up, once', async () => {
        const view = renderWithIntl(<Journey showcaseStays={{}} />);
        expect(snap.goToStop).toHaveBeenCalledTimes(1);
        // The search stage: the hero is stop 0, and the search is the first stage after it.
        expect(JOURNEY_STOPS[snap.goToStop.mock.calls[0][0]]).toBe(STAGES[0].from + (STAGES[0].to - STAGES[0].from) * STAGE_DOCK);

        progress.journey = STAYS_DOCKED;
        view.rerender(withIntl(<Journey showcaseStays={{}} />));
        expect(await screen.findByText(J_EN.stages.golf.caption)).toBeInTheDocument();
        expect(bar.props.defaultMode).toBe('golf');
        expect(snap.goToStop).toHaveBeenCalledTimes(1);
    });

    it('brings the golf search into view on the stacked page, for a visitor who asked for less motion', () => {
        progress.reduced = true;
        renderWithIntl(<Journey showcaseStays={{}} />);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect((scrollIntoView.mock.contexts[0] as HTMLElement).textContent).toContain(J_EN.stages.golf.caption);
        expect(snap.goToStop).not.toHaveBeenCalled();
    });

    it('leaves everyone else on the hero', () => {
        window.history.replaceState(null, '', '/');
        renderWithIntl(<Journey showcaseStays={{}} />);
        expect(snap.goToStop).not.toHaveBeenCalled();
        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});

describe('Journey altitude readout', () => {
    it('labels the altitude in the visitor\'s language and keeps the unit', () => {
        progress.journey = STAYS_DOCKED;
        const { container } = renderWithIntl(<Journey showcaseStays={{}} />, KO);

        const readout = container.querySelector('[aria-hidden]:not(svg) span.tabular-nums');
        expect(readout?.textContent).toContain(J_KO.altitude.label);
        expect(readout?.textContent).toContain(J_KO.altitude.unit);
        expect(readout?.textContent).not.toMatch(/\bAlt\b/i);
    });
});
