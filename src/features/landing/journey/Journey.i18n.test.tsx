import React from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { formatCurrency } from '@/shared/lib/format';
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
vi.mock('./useSectionSnap', () => ({ useSectionSnap: () => undefined }));
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

import { Journey } from './Journey';

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
        renderWithIntl(<Journey showcaseStays={showcaseStays} />, KO);

        const price = formatCurrency(stay.price, stay.currency);
        expect(screen.getByText(J_KO.strip.from.replace('{price}', price))).toBeInTheDocument();
        expect(screen.queryByText(`from ${price}`)).not.toBeInTheDocument();
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

        expect(screen.getByText(J_KO.options.golf)).toBeInTheDocument();
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
            `${J_KO.stages.options.titleLead} ${J_KO.stages.options.titleRest}`,
        ]);
        expect(screen.queryByText('Find your stay.')).not.toBeInTheDocument();
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
