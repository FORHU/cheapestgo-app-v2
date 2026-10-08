import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
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

describe('useDistanceUnit timing and persistence', () => {
    it('gives a client mount the real unit on its first render', () => {
        browserLanguages(['en-US']);
        const values: string[] = [];
        renderHook(() => { const [unit] = useDistanceUnit(); values.push(unit); return unit; });
        expect(values[0]).toBe('mi');
    });

    it('renders km on the server', () => {
        browserLanguages(['en-US']);
        function Probe() { const [unit] = useDistanceUnit(); return createElement('span', null, unit); }
        expect(renderToString(createElement(Probe))).toContain('km');
    });

    it('reads a saved choice back from storage', async () => {
        browserLanguages(['ko-KR']);
        localStorage.setItem('cheapestgo-search-v2', JSON.stringify({ state: { distanceUnit: 'mi' }, version: 0 }));
        await useSearchStore.persist.rehydrate();
        const { result } = renderHook(() => useDistanceUnit());
        expect(result.current[0]).toBe('mi');
    });
});
