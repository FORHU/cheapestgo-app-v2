import { describe, it, expect } from 'vitest';
import { clampDate, isSelectable, monthGrid, monthOf, shiftMonth } from '@/features/golf/lib/calendar';

/** The tee-time date picker's month grid. Dates are "YYYY-MM-DD" with no zone, so it reads the same everywhere. */

describe('calendar', () => {
    it('covers a month in whole weeks starting on Sunday', () => {
        const grid = monthGrid('2026-11');
        expect(grid).toHaveLength(35);
        expect(grid[0]).toEqual({ date: '2026-11-01', inMonth: true }); // 1 Nov 2026 is a Sunday
        expect(grid.at(-1)).toEqual({ date: '2026-12-05', inMonth: false });
    });

    it('pads the first week with the end of the month before', () => {
        expect(monthGrid('2026-12')[0]).toEqual({ date: '2026-11-29', inMonth: false });
    });

    it('moves between months across a year end', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(shiftMonth('2027-01', -1)).toBe('2026-12');
        expect(monthOf('2026-11-15')).toBe('2026-11');
    });

    it('keeps a date inside its bounds', () => {
        expect(isSelectable('2026-11-04', '2026-11-05', '2027-01-02')).toBe(false);
        expect(isSelectable('2026-11-05', '2026-11-05', '2027-01-02')).toBe(true);
        expect(clampDate('2030-01-01', '2026-11-05', '2027-01-02')).toBe('2027-01-02');
        expect(clampDate('2026-12-01', '2026-11-05', '2027-01-02')).toBe('2026-12-01');
    });
});
