import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { useSearchStore } from '@/shared/stores/search.store';

/** jsdom's `navigator.languages` lives on the prototype; shadow it on the instance per test. */
function browserLanguages(languages: string[]) {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => languages });
}

beforeEach(() => {
    localStorage.clear();
    useSearchStore.setState({ distanceUnit: null });
});
afterEach(() => { Reflect.deleteProperty(navigator, 'languages'); });

describe('useDistanceUnit', () => {
    it('guesses miles for a US browser', () => {
        browserLanguages(['en-US']);
        const { result } = renderHook(() => useDistanceUnit());
        expect(result.current[0]).toBe('mi');
    });

    it('guesses kilometres for a Korean browser', () => {
        browserLanguages(['ko-KR']);
        const { result } = renderHook(() => useDistanceUnit());
        expect(result.current[0]).toBe('km');
    });

    it('prefers the viewer’s choice over the guess and remembers it', () => {
        browserLanguages(['en-US']);
        const { result } = renderHook(() => useDistanceUnit());

        act(() => result.current[1]('km'));

        expect(result.current[0]).toBe('km');
        const saved = JSON.parse(localStorage.getItem('cheapestgo-search-v2') ?? '{}');
        expect(saved.state.distanceUnit).toBe('km');
    });
});
