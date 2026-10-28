import { describe, it, expect } from 'vitest';
import { formatStayDates } from '@/features/checkout/lib/checkout.helpers';

describe('formatStayDates', () => {
    it('keeps one month name when the stay stays within a month', () => {
        expect(formatStayDates('2026-09-04', '2026-09-06')).toBe('September 4 - 6 2026 (2 nights)');
    });

    it('names both months when the stay crosses one', () => {
        expect(formatStayDates('2026-08-30', '2026-09-02')).toBe('August 30 - September 2 2026 (3 nights)');
    });

    it('says "1 night" without the plural', () => {
        expect(formatStayDates('2026-09-04', '2026-09-05')).toBe('September 4 - 5 2026 (1 night)');
    });

    it('returns an empty string when either date is missing or unparseable', () => {
        expect(formatStayDates('', '2026-09-06')).toBe('');
        expect(formatStayDates('2026-09-04', '')).toBe('');
        expect(formatStayDates('not-a-date', '2026-09-06')).toBe('');
    });
});
