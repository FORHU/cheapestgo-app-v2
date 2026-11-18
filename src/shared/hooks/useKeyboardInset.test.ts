import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useKeyboardInset } from './useKeyboardInset';

/**
 * Where the on-screen keyboard is, read from the visual viewport — which jsdom does not have, so
 * each test hands the window one it can resize the way a phone's keyboard does.
 */

class FakeViewport extends EventTarget {
    height = 664;
    offsetTop = 0;
    scale = 1;
    set(next: Partial<Pick<FakeViewport, 'height' | 'offsetTop' | 'scale'>>) {
        Object.assign(this, next);
        this.dispatchEvent(new Event('resize'));
    }
}

let vv: FakeViewport;
beforeEach(() => {
    vv = new FakeViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 664 });
});
afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

describe('useKeyboardInset', () => {
    it('reports nothing while the keyboard is down', () => {
        const { result } = renderHook(() => useKeyboardInset());
        expect(result.current).toEqual({ inset: 0, visibleHeight: null });
    });

    it('reports how much of the screen the keyboard covers, and what is left above it', () => {
        const { result } = renderHook(() => useKeyboardInset());
        act(() => vv.set({ height: 364 }));
        expect(result.current).toEqual({ inset: 300, visibleHeight: 364 });
    });

    it('counts a visual viewport iOS has panned up to the field', () => {
        const { result } = renderHook(() => useKeyboardInset());
        act(() => vv.set({ height: 364, offsetTop: 40 }));
        expect(result.current.inset).toBe(260);
    });

    it('takes a toolbar settling for what it is, not a keyboard', () => {
        const { result } = renderHook(() => useKeyboardInset());
        act(() => vv.set({ height: 610 }));
        expect(result.current).toEqual({ inset: 0, visibleHeight: null });
    });

    it('takes a pinch zoom for what it is, not a keyboard', () => {
        const { result } = renderHook(() => useKeyboardInset());
        act(() => vv.set({ height: 332, scale: 2 }));
        expect(result.current).toEqual({ inset: 0, visibleHeight: null });
    });

    it('goes back to nothing when the keyboard goes down', () => {
        const { result } = renderHook(() => useKeyboardInset());
        act(() => vv.set({ height: 364 }));
        act(() => vv.set({ height: 664 }));
        expect(result.current).toEqual({ inset: 0, visibleHeight: null });
    });

    it('does not listen while its sheet is closed', () => {
        const { result } = renderHook(() => useKeyboardInset(false));
        act(() => vv.set({ height: 364 }));
        expect(result.current).toEqual({ inset: 0, visibleHeight: null });
    });
});
