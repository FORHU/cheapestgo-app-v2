import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { checkoutPalette } from '../../lib/palette';
import { SelectField } from '../select-field';

const palette = checkoutPalette('dark');
const OPTIONS = [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }];

function Harness({ spy, initial = '' }: { spy?: (v: string) => void; initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
        <>
            <label htmlFor="gender">Gender</label>
            <SelectField id="gender" value={value} options={OPTIONS} placeholder="Choose"
                onChange={(v) => { setValue(v); spy?.(v); }} palette={palette} />
        </>
    );
}

const trigger = () => screen.getByLabelText('Gender');
const listbox = () => screen.getByRole('listbox');

describe('SelectField', () => {
    it('is a labelled control that says what to do until something is chosen', () => {
        render(<Harness />);
        expect(trigger()).toHaveTextContent('Choose');
        expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens its options in the shared picker panel, and takes a choice', () => {
        const spy = vi.fn();
        render(<Harness spy={spy} />);
        fireEvent.click(trigger());

        expect(listbox().closest('.cg-picker-panel')).not.toBeNull();
        fireEvent.click(within(listbox()).getByRole('option', { name: 'Female' }));

        expect(spy).toHaveBeenCalledWith('F');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(trigger()).toHaveTextContent('Female');
    });

    it('marks the chosen option', () => {
        render(<Harness initial="M" />);
        fireEvent.click(trigger());
        expect(within(listbox()).getByRole('option', { name: 'Male' })).toHaveAttribute('aria-selected', 'true');
        expect(within(listbox()).getByRole('option', { name: 'Female' })).toHaveAttribute('aria-selected', 'false');
    });

    it('moves with the arrow keys and picks with Enter', () => {
        const spy = vi.fn();
        render(<Harness spy={spy} />);
        fireEvent.click(trigger());
        expect(document.activeElement).toHaveAccessibleName('Male');
        fireEvent.keyDown(listbox(), { key: 'ArrowDown' });
        expect(document.activeElement).toHaveAccessibleName('Female');
        fireEvent.keyDown(listbox(), { key: 'Home' });
        expect(document.activeElement).toHaveAccessibleName('Male');
        fireEvent.click(document.activeElement as HTMLElement);
        expect(spy).toHaveBeenCalledWith('M');
    });

    it('closes on Escape and hands focus back to the field', () => {
        render(<Harness />);
        fireEvent.click(trigger());
        fireEvent.keyDown(listbox(), { key: 'Escape' });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(trigger()).toHaveFocus();
    });

    it('closes when the page around it is clicked', () => {
        render(<Harness />);
        fireEvent.click(trigger());
        fireEvent.click(screen.getByTestId('picker-backdrop'));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
