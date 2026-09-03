import { describe, it, expect } from 'vitest';
import { buildConfirmGuests, formatStayDates } from '@/features/checkout/lib/checkout.helpers';

describe('buildConfirmGuests', () => {
    const holder = { firstName: 'Dil', lastName: 'Doe', email: 'dil@example.com' };

    it('returns the holder alone as occupant 1 when there are no co-guests', () => {
        expect(buildConfirmGuests(holder, [])).toEqual([
            { occupancyNumber: 1, firstName: 'Dil', lastName: 'Doe', email: 'dil@example.com' },
        ]);
    });

    it('numbers co-guests from 2 and gives them the holder email', () => {
        const out = buildConfirmGuests(holder, [
            { firstName: 'Mike', lastName: 'Hunt' },
            { firstName: 'Ana', lastName: 'Cruz' },
        ]);
        expect(out).toEqual([
            { occupancyNumber: 1, firstName: 'Dil', lastName: 'Doe', email: 'dil@example.com' },
            { occupancyNumber: 2, firstName: 'Mike', lastName: 'Hunt', email: 'dil@example.com' },
            { occupancyNumber: 3, firstName: 'Ana', lastName: 'Cruz', email: 'dil@example.com' },
        ]);
    });

    it('trims whitespace off every name and the email', () => {
        const out = buildConfirmGuests(
            { firstName: '  Dil ', lastName: ' Doe ', email: '  dil@example.com ' },
            [{ firstName: ' Mike', lastName: 'Hunt ' }],
        );
        expect(out[0]).toEqual({ occupancyNumber: 1, firstName: 'Dil', lastName: 'Doe', email: 'dil@example.com' });
        expect(out[1]).toEqual({ occupancyNumber: 2, firstName: 'Mike', lastName: 'Hunt', email: 'dil@example.com' });
    });
});

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
