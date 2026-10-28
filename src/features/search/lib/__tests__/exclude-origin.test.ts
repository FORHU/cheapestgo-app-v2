import { describe, expect, it } from 'vitest';
import { excludeOrigin } from '../exclude-origin';

const airport = (code: string, city: string) => ({ title: `${city} (${code})`, code });

const mnl = airport('MNL', 'Manila');
const icn = airport('ICN', 'Seoul');
const nrt = airport('NRT', 'Tokyo');

describe('excludeOrigin', () => {
    it('drops the airport the origin names, as the token labels it', () => {
        expect(excludeOrigin([mnl, icn, nrt], 'Manila (MNL)')).toEqual([icn, nrt]);
    });

    it('reads a bare code from a deep link the same way', () => {
        expect(excludeOrigin([mnl, icn, nrt], 'MNL')).toEqual([icn, nrt]);
    });

    it('leaves the list alone before an origin is picked', () => {
        expect(excludeOrigin([mnl, icn], null)).toEqual([mnl, icn]);
        expect(excludeOrigin([mnl, icn], '')).toEqual([mnl, icn]);
    });

    it('falls back to the title for an origin with no code in it', () => {
        const place = { title: 'Clark' };
        expect(excludeOrigin([place, icn], 'Clark')).toEqual([icn]);
    });

    it('keeps another airport in the same city', () => {
        const hnd = airport('HND', 'Tokyo');
        expect(excludeOrigin([nrt, hnd], 'Tokyo (NRT)')).toEqual([hnd]);
    });
});
