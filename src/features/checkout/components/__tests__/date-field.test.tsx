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
        fireEvent.click(screen.getByTestId('date-field-backdrop'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
