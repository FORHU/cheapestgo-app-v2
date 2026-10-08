import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DistanceUnitToggle } from '@/shared/components/common/DistanceUnitToggle';

const COLORS = { muted: '#64748b', border: '#e2e8f0', activeBg: '#2563eb', activeFg: '#fff' };

describe('DistanceUnitToggle', () => {
    it('marks the current unit and reports a switch', () => {
        const onChange = vi.fn();
        render(<DistanceUnitToggle value="km" onChange={onChange} label="Distance unit" colors={COLORS} />);

        expect(screen.getByRole('radiogroup', { name: 'Distance unit' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'km' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'mi' })).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));
        expect(onChange).toHaveBeenCalledWith('mi');
    });

    it('ignores a click on the unit already chosen', () => {
        const onChange = vi.fn();
        render(<DistanceUnitToggle value="km" onChange={onChange} label="Distance unit" colors={COLORS} />);

        fireEvent.click(screen.getByRole('radio', { name: 'km' }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
