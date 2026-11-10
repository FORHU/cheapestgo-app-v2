import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkoutPalette } from '../../lib/palette';
import { SelectField } from '../select-field';
import { isInPickerLayer } from '../picker-panel';

/**
 * The checkout's dropdown, now the site's — the flight filters' times, a child's age in the
 * search bar, the account's currency. What those places need of it beyond the checkout's form:
 * a name without a `<label>`, a way for a popover to tell its clicks from the page's, and a
 * panel that stays on the screen when its field is near the right edge.
 */

const palette = checkoutPalette('dark');
const OPTIONS = [{ value: '0', label: '00:00' }, { value: '30', label: '00:30' }, { value: '60', label: '01:00' }];

function Harness({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState('30');
    return (
        <SelectField id="t" ariaLabel="Departure from" value={value} options={OPTIONS} placeholder="Time"
            onChange={(v) => { setValue(v); onChange(v); }} palette={palette} panelWidth={160} />
    );
}

afterEach(() => vi.restoreAllMocks());

describe('SelectField outside the checkout', () => {
    it('is named by what it is for and what is chosen, where no <label> names it', () => {
        render(<Harness />);
        expect(screen.getByRole('button', { name: 'Departure from: 00:30' })).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('says the new choice in its name once one is picked', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Departure from: 00:30' }));
        fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: '01:00' }));
        expect(onChange).toHaveBeenCalledWith('60');
        expect(screen.getByRole('button', { name: 'Departure from: 01:00' })).toBeInTheDocument();
    });

    it('marks its panel and backdrop as the picker layer, for a popover that closes on clicks outside it', () => {
        render(<Harness />);
        expect(isInPickerLayer(document.body)).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: /Departure from/ }));
        expect(isInPickerLayer(screen.getByRole('option', { name: '01:00' }))).toBe(true);
        expect(isInPickerLayer(screen.getByTestId('picker-backdrop'))).toBe(true);
    });

    // A field on the right of a narrow row — a filter's "to" time — would open its panel off
    // the right of the screen, level with its own left edge.
    it('opens leftwards when its field sits too near the right of the screen', () => {
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(160);
        render(<Harness />);
        const field = screen.getByRole('button', { name: /Departure from/ }).parentElement as HTMLElement;
        vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(
            { top: 300, bottom: 336, left: 300, right: 380, width: 80, height: 36, x: 300, y: 300, toJSON: () => ({}) } as DOMRect,
        );
        fireEvent.click(screen.getByRole('button', { name: /Departure from/ }));
        const panel = screen.getByRole('listbox').closest('.cg-picker-panel') as HTMLElement;
        // 390 wide, a 160px panel, 16px from the edge: 214, not the field's 300.
        expect(panel.style.left).toBe('214px');
        expect(panel.style.top).toBe('344px');
    });
});
