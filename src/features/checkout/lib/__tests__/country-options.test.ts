import { describe, expect, it } from 'vitest';
import { getCountryOptions } from '../country-options';

describe('getCountryOptions', () => {
    it('offers a broad set of countries using ISO alpha-2 values, with the Philippines first', () => {
        const options = getCountryOptions('en');

        expect(options.length).toBeGreaterThan(200);
        expect(options[0]).toEqual({ value: 'PH', label: 'Philippines (PH)' });
        expect(options).toContainEqual({ value: 'US', label: 'United States (US)' });
        expect(new Set(options.map(({ value }) => value)).size).toBe(options.length);
    });

    it('localizes country names for the active checkout locale', () => {
        expect(getCountryOptions('ja').find(({ value }) => value === 'JP')).toEqual({
            value: 'JP',
            label: '日本 (JP)',
        });
    });
});
