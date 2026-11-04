import { describe, it, expect } from 'vitest';
import { clockTime, teeTimeLabels } from '@/features/golf/lib/format';

describe('clockTime', () => {
    it.each([
        ['00:30', '12:30 AM'],
        ['07:30', '7:30 AM'],
        ['12:00', '12:00 PM'],
        ['13:30', '1:30 PM'],
        ['21:00', '9:00 PM'],
    ])('reads %s as %s', (localTime, label) => {
        expect(clockTime(localTime, 'en')).toBe(label);
    });

    // The words for morning and afternoon are ICU's, and move between versions: Korean is "오전 7:30"
    // in Chrome and "AM 7:30" in Node 24. The clock is what must not move.
    it.each(['ko', 'ja', 'zh'])('stays on a 12-hour clock in %s', (locale) => {
        expect(clockTime('13:30', locale)).toContain('1:30');
    });
});

describe('teeTimeLabels', () => {
    it("tells the time on the course's clock, whatever the visitor's is", () => {
        expect(teeTimeLabels('2026-11-20T00:00:00Z', 'Asia/Tokyo', 'en').time).toBe('9:00 AM');
    });

    it('falls back to UTC for a course with no time zone', () => {
        expect(teeTimeLabels('2026-11-20T00:00:00Z', null, 'en').time).toBe('12:00 AM');
    });
});
