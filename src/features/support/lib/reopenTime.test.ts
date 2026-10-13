import { describe, it, expect } from 'vitest';
import { formatReopen } from '@/features/support/lib/reopenTime';

/**
 * "Back Monday from 9:00 AM (Asia/Manila)".
 *
 * The one thing that makes an overnight wait bearable is knowing how long it is. The value
 * has been computed and returned by the API since the hours were built; nothing rendered
 * it, so a customer escalating at 3am was told only "when support hours resume".
 *
 * Formatted on the client from the current hours, so editing them in the desk changes what
 * a waiting customer sees — rather than being baked into a stored message that goes stale.
 */

const opening = { day: 'mon' as const, open: '09:00', timezone: 'Asia/Manila', today: false };

describe('formatReopen', () => {
    it('names the day and the time', () => {
        const result = formatReopen(opening, 'en');

        expect(result?.when).toContain('Monday');
        expect(result?.when).toContain('9');
        expect(result?.today).toBe(false);
    });

    it('leaves the weekday out when it is today, and says so', () => {
        // "Back Monday from 9:00" read at 7am on Monday is a puzzle, not an answer. The
        // word "today" is the panel's to supply, because it has to be translated.
        const result = formatReopen({ ...opening, today: true }, 'en');

        expect(result?.today).toBe(true);
        expect(result?.when).not.toContain('Monday');
    });

    it('names the timezone, because the customer may not be in it', () => {
        expect(formatReopen(opening, 'en')?.when).toContain('Asia/Manila');
    });

    it('uses the reader\'s language for the day name', () => {
        expect(formatReopen(opening, 'ko')?.when).toContain('월요일');
    });

    it('returns nothing when there is no opening to name', () => {
        // A schedule with every day closed. Better silent than "back on null".
        expect(formatReopen(null, 'en')).toBeNull();
    });

    it('returns nothing rather than throwing on a broken value', () => {
        expect(formatReopen({ ...opening, open: 'nonsense' }, 'en')).toBeNull();
    });
});
