import React from 'react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyDescription } from '@/features/hotels/components/property-description';
import { ThemeProvider } from '@/shared/components/ThemeContext';

/**
 * jsdom ships neither ResizeObserver nor real layout, and the panel needs both:
 * one to notice a reflow, the other to decide whether the clamp is cutting the
 * description off. The observer is stubbed away here; the measurement is left
 * at its jsdom default (0 vs 0, so "not overflowing") and overridden only by
 * the one test that is about it.
 */
beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class {
        observe() {}
        unobserve() {}
        disconnect() {}
    });
});

afterEach(cleanup);

/**
 * The panel reads the app theme as its `tone` default, so it wants the provider
 * the app mounts at its root — supplied here rather than worked around, since
 * every real caller has one above it.
 */
const render = (ui: React.ReactElement) => rtlRender(<ThemeProvider>{ui}</ThemeProvider>);

/** The property page hardcodes its own dark, so it hands the tone in; these
 *  tests do the same, which keeps them off the theme default. */
const base = { tone: 'dark' as const };

describe('PropertyDescription', () => {
    it('prints the currency symbol and the amount as separate type', () => {
        render(<PropertyDescription {...base} price={3000} currency="PHP" />);
        expect(screen.getByText('₱')).toBeInTheDocument();
        expect(screen.getByText('3,000')).toBeInTheDocument();
        expect(screen.getByText('/night')).toBeInTheDocument();
    });

    it('falls back to the code when a currency has no symbol', () => {
        render(<PropertyDescription {...base} price={120} currency="XYZ" />);
        expect(screen.getByText('XYZ')).toBeInTheDocument();
    });

    it('renders the rating to one decimal, with the score carrying the weight', () => {
        render(<PropertyDescription {...base} rating={8.42} />);
        // The design bolds the number and leaves the word beside it lighter, so
        // the two are separate elements and the line reads across both.
        const score = screen.getByText('8.4');
        expect(score.tagName).toBe('B');
        expect(score.parentElement).toHaveTextContent('8.4 rating');
    });

    it('converts a 24-hour desk time to the clock the design draws', () => {
        render(<PropertyDescription {...base} checkInTime="15:00" checkOutTime="08:00" />);
        expect(screen.getByText('3:00 PM')).toBeInTheDocument();
        expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    });

    it('passes an already-worded time through untouched', () => {
        render(<PropertyDescription {...base} checkInTime="from noon" />);
        expect(screen.getByText('from noon')).toBeInTheDocument();
    });

    it('draws no IN/OUT pair when the supplier sent neither time', () => {
        render(<PropertyDescription {...base} price={100} currency="USD" />);
        expect(screen.queryByText('In')).not.toBeInTheDocument();
        expect(screen.queryByText('Out')).not.toBeInTheDocument();
    });

    it('leads with the near-universal comforts and leaves the rest to the modal', () => {
        render(
            <PropertyDescription
                {...base}
                amenities={['Free Wi-Fi', 'Air conditioning', 'Private bathroom', 'Swimming pool', 'Fitness centre']}
            />,
        );

        // "General Amenities" is a short, fixed row: it leads with what a guest
        // already assumes is there.
        expect(screen.getByText('Free Wi-Fi')).toBeInTheDocument();
        expect(screen.getByText('Air conditioning')).toBeInTheDocument();
        expect(screen.getByText('Private bathroom')).toBeInTheDocument();

        // A pool and a gym are the hotel's more particular facilities. Those
        // are the room-detail modal's to list, not this row's.
        expect(screen.queryByText('Swimming pool')).not.toBeInTheDocument();
        expect(screen.queryByText('Fitness centre')).not.toBeInTheDocument();

        // And the row carries no disclosure of its own — with the list already
        // narrowed to the comforts, there is nothing left to hold behind one.
        expect(screen.queryByRole('button', { name: 'See all amenities' })).not.toBeInTheDocument();
    });

    it('keeps the desk hours clear of the amenities column', () => {
        render(
            <PropertyDescription
                {...base}
                checkInTime="15:00"
                checkOutTime="08:00"
                amenities={['Free Wi-Fi', 'Air conditioning', 'Private bathroom', 'Smoking Allowed', 'Parking', 'Swimming pool']}
            />,
        );

        const times = screen.getByText('3:00 PM').closest('dl')!;
        // The group's own box is the row; the list is inside it.
        const chipGroup = screen.getByText('Free Wi-Fi').closest('ul')!.parentElement!;

        // Two rows, not one. The hours sit in the head row beside the price and
        // rating; the chips are a row of their own beneath it. That separation
        // is the whole mechanism — a long amenity row grows downward into its
        // own row and cannot drag IN and OUT with it, the way it did when the
        // two shared a flex row and the hours were bottom-aligned in it.
        expect(times.parentElement).not.toBe(chipGroup.parentElement);
        expect(times.parentElement!.contains(chipGroup)).toBe(false);
        expect(times.parentElement!.className).toContain('items-start');
    });

    it('files house rules under policies, not amenities', () => {
        render(
            <PropertyDescription
                {...base}
                amenities={['Air conditioning', 'Smoking Allowed', 'Pets allowed', 'Internet Access']}
            />,
        );

        // An amenity is something the stay gives you; a policy is something
        // it asks of you. Suppliers return one flat list of both.
        const group = (label: string) => screen.getByText(label).closest('div')!;
        expect(group('General Amenities')).toHaveTextContent('Air conditioning');
        expect(group('General Amenities')).toHaveTextContent('Internet Access');
        expect(group('General Amenities')).not.toHaveTextContent('Smoking Allowed');

        expect(group('Rules & Policies')).toHaveTextContent('Smoking Allowed');
        expect(group('Rules & Policies')).toHaveTextContent('Pets allowed');
        expect(group('Rules & Policies')).not.toHaveTextContent('Air conditioning');
    });

    it('draws no policies group when the hotel states none', () => {
        render(<PropertyDescription {...base} amenities={['Elevator / Lift', 'Internet Access']} />);
        expect(screen.queryByText('Rules & Policies')).not.toBeInTheDocument();
    });

    it('offers no amenities link when they all fit', () => {
        render(<PropertyDescription {...base} amenities={['Wifi', 'Parking']} />);
        expect(screen.queryByRole('button', { name: 'See all amenities' })).not.toBeInTheDocument();
    });

    it('offers no Read more when the description is not actually clamped', () => {
        render(<PropertyDescription {...base} description="Two short lines." />);
        expect(screen.getByText('Two short lines.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
    });

    it('clamps the collapsed description to a line count, not a pixel height', () => {
        // `WebkitLineClamp` is unitless. If React ever emitted it as `5px` the
        // clamp would silently stop clamping and the panel would print the
        // supplier's whole write-up with a Read more link under it.
        render(<PropertyDescription {...base} description="A supplier write-up." />);
        const body = screen.getByText('A supplier write-up.');
        expect(body.style.webkitLineClamp).toBe('5');
        expect(body.style.overflow).toBe('hidden');
    });

    it('opens and closes a clamped description', async () => {
        // The one test that needs layout: a paragraph taller than its own box is
        // what "clamped" means, and jsdom reports both as 0 without this.
        const scrollH = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
        const clientH = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
        const user = userEvent.setup();

        render(<PropertyDescription {...base} description="A very long supplier write-up." />);

        await user.click(screen.getByRole('button', { name: 'Read more' }));
        expect(screen.getByRole('button', { name: 'Read less' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Read less' }));
        expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();

        scrollH.mockRestore();
        clientH.mockRestore();
    });

    it('renders nothing when it has been handed nothing', () => {
        // Marked rather than matched on the tag: the provider mounts a Toaster,
        // which is a <section> of its own, so the class the panel would have
        // carried is what says whether the panel is there.
        const { container } = render(<PropertyDescription {...base} className="panel-under-test" />);
        expect(container.querySelector('.panel-under-test')).toBeNull();
    });
});
