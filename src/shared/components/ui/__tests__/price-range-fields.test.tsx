/**
 * The stays filter's price range, typed rather than dragged: a person with a budget in mind sets
 * the minimum and maximum directly. The fields apply themselves once typing pauses or the field
 * is left, refuse what cannot be a price, and keep the last sensible range applied while one is
 * wrong.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filtersPalette, PriceRangeFields, PRICE_FIELD_SETTLE_MS } from '@/shared/components/ui/filter-panel';

const LABELS = {
    min: 'Min', max: 'Max',
    minFull: 'Minimum price per night', maxFull: 'Maximum price per night',
    empty: 'Enter a price.',
    minAboveMax: "Minimum can't be more than the maximum.",
    maxBelowMin: "Maximum can't be less than the minimum.",
};

/** Holds the range and clamps it to the results' span, as the search page does. */
function Harness({ onApply }: { onApply: (lo: number, hi: number) => void }) {
    const floor = 40, ceiling = 450;
    const [range, setRange] = useState({ lo: floor, hi: ceiling });
    return (
        <PriceRangeFields
            low={range.lo}
            high={range.hi}
            symbol="$"
            palette={filtersPalette('light')}
            labels={LABELS}
            onChange={(lo, hi) => {
                onApply(lo, hi);
                setRange({ lo: Math.max(lo, floor), hi: Math.min(hi, ceiling) });
            }}
        />
    );
}

const min = () => screen.getByRole('textbox', { name: LABELS.minFull }) as HTMLInputElement;
const max = () => screen.getByRole('textbox', { name: LABELS.maxFull }) as HTMLInputElement;
const settle = () => act(() => { vi.advanceTimersByTime(PRICE_FIELD_SETTLE_MS); });

let onApply: ReturnType<typeof vi.fn<(lo: number, hi: number) => void>>;
beforeEach(() => {
    vi.useFakeTimers();
    onApply = vi.fn<(lo: number, hi: number) => void>();
    render(<Harness onApply={onApply} />);
});
afterEach(() => vi.useRealTimers());

describe('PriceRangeFields', () => {
    it('starts from the range the results span', () => {
        expect(min().value).toBe('40');
        expect(max().value).toBe('450');
    });

    it('applies a typed minimum once typing pauses', () => {
        fireEvent.focus(min());
        fireEvent.change(min(), { target: { value: '120' } });
        expect(onApply).not.toHaveBeenCalled();
        settle();
        expect(onApply).toHaveBeenLastCalledWith(120, 450);
    });

    it('applies a typed maximum at once on Enter', () => {
        fireEvent.focus(max());
        fireEvent.change(max(), { target: { value: '300' } });
        fireEvent.keyDown(max(), { key: 'Enter' });
        expect(onApply).toHaveBeenLastCalledWith(40, 300);
    });

    it('cannot be given a negative or a letter', () => {
        fireEvent.focus(min());
        fireEvent.change(min(), { target: { value: '-5a0' } });
        expect(min().value).toBe('50');
    });

    it('refuses a minimum above the maximum, says why, and leaves the filter alone', () => {
        fireEvent.focus(min());
        fireEvent.change(min(), { target: { value: '500' } });
        fireEvent.blur(min());
        expect(onApply).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(LABELS.minAboveMax);
        expect(min()).toHaveAttribute('aria-invalid', 'true');
        expect(min().value).toBe('500');
    });

    it('refuses a maximum below the minimum', () => {
        fireEvent.focus(max());
        fireEvent.change(max(), { target: { value: '10' } });
        fireEvent.blur(max());
        expect(onApply).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(LABELS.maxBelowMin);
    });

    it('asks for a price when a field is left empty', () => {
        fireEvent.focus(max());
        fireEvent.change(max(), { target: { value: '' } });
        fireEvent.blur(max());
        expect(screen.getByRole('alert')).toHaveTextContent(LABELS.empty);
    });

    it('clears the message once the value is put right', () => {
        fireEvent.focus(min());
        fireEvent.change(min(), { target: { value: '500' } });
        fireEvent.blur(min());
        fireEvent.focus(min());
        fireEvent.change(min(), { target: { value: '200' } });
        fireEvent.blur(min());
        expect(screen.getByRole('alert')).toBeEmptyDOMElement();
        expect(onApply).toHaveBeenLastCalledWith(200, 450);
    });

    it('shows the clamped value once a value past the range is left', () => {
        fireEvent.focus(max());
        fireEvent.change(max(), { target: { value: '9999' } });
        fireEvent.blur(max());
        expect(onApply).toHaveBeenLastCalledWith(40, 9999);
        expect(max().value).toBe('450');
    });
});
