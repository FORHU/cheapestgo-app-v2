import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { checkoutPalette } from '../../lib/palette';
import { DateField } from '../date-field';

const palette = checkoutPalette('dark');

function Harness(props: Partial<React.ComponentProps<typeof DateField>> & { initial?: string; spy?: (v: string) => void }) {
    const { initial = '', spy, ...rest } = props;
    const [value, setValue] = useState(initial);
    return (
        <NextIntlClientProvider locale="en" messages={en as never}>
            <label htmlFor="dob">Date of birth</label>
            <DateField
                id="dob"
                value={value}
                onChange={(v) => { setValue(v); spy?.(v); }}
                min="1906-12-01"
                max="2014-12-01"
                anchor="1996-12-01"
                openTo="year"
                palette={palette}
                {...rest}
            />
        </NextIntlClientProvider>
    );
}

const open = () => fireEvent.click(screen.getByLabelText('Date of birth'));
const dialog = () => screen.getByRole('dialog');

describe('DateField', () => {
    it('is a labelled control that says what to do until a date is chosen', () => {
        render(<Harness />);
        const trigger = screen.getByLabelText('Date of birth');
        expect(trigger).toHaveTextContent('Select date');
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('reaches a birthday in three choices: year, month, day', () => {
        const spy = vi.fn();
        render(<Harness spy={spy} />);
        open();

        // The checkout's one picker panel, shared with its dropdowns.
        expect(dialog().classList.contains('cg-picker-panel')).toBe(true);
        // Opens on the years around the likely one, not on this month.
        fireEvent.click(within(dialog()).getByRole('button', { name: '1990' }));
        fireEvent.click(within(dialog()).getByRole('button', { name: 'May 1990' }));
        fireEvent.click(within(dialog()).getByRole('button', { name: 'May 14, 1990' }));

        expect(spy).toHaveBeenCalledWith('1990-05-14');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Date of birth')).toHaveTextContent('14 May 1990');
    });

    it('opens on the chosen date when there is one', () => {
        render(<Harness initial="1990-05-14" />);
        open();
        const chosen = within(dialog()).getByRole('button', { name: 'May 14, 1990' });
        expect(chosen).toHaveAttribute('aria-pressed', 'true');
    });

    it('opens on the anchor\'s month when told to open on days', () => {
        render(<Harness openTo="day" min="2026-12-01" max="2046-10-19" anchor="2026-12-01" />);
        open();
        expect(within(dialog()).getByText('December 2026')).toBeInTheDocument();
    });

    it('will not offer a date outside its limits', () => {
        render(<Harness initial="2014-12-01" />);
        open();
        expect(within(dialog()).getByRole('button', { name: 'December 1, 2014' })).toBeEnabled();
        expect(within(dialog()).getByRole('button', { name: 'December 2, 2014' })).toBeDisabled();
        expect(within(dialog()).getByRole('button', { name: 'Next month' })).toBeDisabled();

        fireEvent.click(within(dialog()).getByRole('button', { name: 'Choose year and month' }));
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Choose year' }));
        expect(within(dialog()).getByRole('button', { name: '2015' })).toBeDisabled();
    });

    it('climbs from days to months to years from its heading', () => {
        render(<Harness initial="1990-05-14" />);
        open();
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Choose year and month' }));
        expect(within(dialog()).getByRole('button', { name: 'January 1990' })).toBeInTheDocument();
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Choose year' }));
        expect(within(dialog()).getByRole('button', { name: '1990' })).toBeInTheDocument();
    });

    it('moves by day and week with the arrow keys, and picks with Enter', () => {
        const spy = vi.fn();
        render(<Harness initial="1990-05-14" spy={spy} />);
        open();
        const grid = within(dialog()).getByRole('grid');
        fireEvent.keyDown(grid, { key: 'ArrowRight' });
        fireEvent.keyDown(grid, { key: 'ArrowDown' });
        expect(document.activeElement).toHaveAccessibleName('May 22, 1990');
        fireEvent.keyDown(grid, { key: 'PageDown' });
        expect(document.activeElement).toHaveAccessibleName('June 22, 1990');
        fireEvent.click(document.activeElement as HTMLElement);
        expect(spy).toHaveBeenCalledWith('1990-06-22');
    });

    it('closes on Escape and hands focus back to the field', () => {
        render(<Harness />);
        open();
        fireEvent.keyDown(dialog(), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Date of birth')).toHaveFocus();
    });

    it('closes when the page around it is clicked', () => {
        render(<Harness />);
        open();
        fireEvent.click(screen.getByTestId('picker-backdrop'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // On a phone the support chat button (z-index 50) and the brand preview switcher (70) float
    // over the bottom of the screen. Drawn inside the field, the calendar sat beneath them, and
    // after a step change beneath anything outside the step's own layer: the dates under them
    // could not be tapped.
    it('opens at the top of the page, above the controls that float over it, under its field', () => {
        const { container } = render(<Harness />);
        const field = screen.getByLabelText('Date of birth').parentElement as HTMLElement;
        vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(
            { top: 500, bottom: 548, left: 16, right: 374, width: 358, height: 48, x: 16, y: 500, toJSON: () => ({}) } as DOMRect,
        );
        open();

        expect(container.contains(dialog())).toBe(false);
        expect(dialog().parentElement).toBe(document.body);
        expect(Number(dialog().style.zIndex)).toBeGreaterThan(70);
        expect(Number(screen.getByTestId('picker-backdrop').style.zIndex)).toBeGreaterThan(70);
        // Still placed under its field: 8px below its bottom edge, level with its left.
        expect(dialog().style.top).toBe('556px');
        expect(dialog().style.left).toBe('16px');
    });

    it('closes on Tab and hands focus back to the field, so Tab carries on through the form', () => {
        render(<Harness />);
        open();
        fireEvent.keyDown(dialog(), { key: 'Tab' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Date of birth')).toHaveFocus();
    });
});
