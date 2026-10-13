import { StrictMode, createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';

afterEach(() => { document.body.style.overflow = ''; });

describe('useBodyScrollLock', () => {
    it('restores the original value only after both overlapping locks release (first released first)', () => {
        document.body.style.overflow = 'auto';
        const a = renderHook(() => useBodyScrollLock(true));
        const b = renderHook(() => useBodyScrollLock(true));
        expect(document.body.style.overflow).toBe('hidden');
        a.unmount();
        expect(document.body.style.overflow).toBe('hidden');
        b.unmount();
        expect(document.body.style.overflow).toBe('auto');
    });

    it('restores the original value only after both release (last released first)', () => {
        document.body.style.overflow = 'auto';
        const a = renderHook(() => useBodyScrollLock(true));
        const b = renderHook(() => useBodyScrollLock(true));
        b.unmount();
        expect(document.body.style.overflow).toBe('hidden');
        a.unmount();
        expect(document.body.style.overflow).toBe('auto');
    });

    it('does nothing while inactive', () => {
        document.body.style.overflow = 'auto';
        const a = renderHook(() => useBodyScrollLock(false));
        expect(document.body.style.overflow).toBe('auto');
        a.unmount();
    });

    it('is StrictMode-safe', () => {
        document.body.style.overflow = 'auto';
        const a = renderHook(() => useBodyScrollLock(true), { wrapper: ({ children }) => createElement(StrictMode, null, children) });
        expect(document.body.style.overflow).toBe('hidden');
        a.unmount();
        expect(document.body.style.overflow).toBe('auto');
    });
});
