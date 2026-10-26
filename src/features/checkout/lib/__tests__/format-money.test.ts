import { describe, it, expect } from 'vitest';
import { formatMoney } from '../format-money';

describe('formatMoney', () => {
    it('shows cents for a currency that has them — a charge of 272.40 must not read as 272', () => {
        expect(formatMoney(272.4, 'USD')).toBe('USD 272.40');
        expect(formatMoney(250, 'USD')).toBe('USD 250.00');
        expect(formatMoney(5800, 'PHP')).toBe('PHP 5,800.00');
    });

    it('shows none for a currency that has none', () => {
        expect(formatMoney(272400, 'KRW')).toBe('KRW 272,400');
        expect(formatMoney(31500, 'JPY')).toBe('JPY 31,500');
    });

    it('falls back to two decimals for a code it does not know, rather than throwing mid-render', () => {
        expect(formatMoney(10, 'NOT-A-CODE')).toBe('NOT-A-CODE 10.00');
        expect(formatMoney(10, '')).toBe(' 10.00'.trim());
    });
});
