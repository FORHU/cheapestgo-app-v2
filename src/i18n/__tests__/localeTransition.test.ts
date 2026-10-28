import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { switchLocale, markLocaleRendered, LOCALE_TRANSITION_TIMEOUT_MS } from '../localeTransition';

/**
 * Changing language dissolves the old page into the new one rather than cutting between them.
 *
 * The browser snapshots the old page, the switch runs, and the fade starts only once the new
 * language has actually rendered — start it earlier and it fades into the old page again. A
 * browser without view transitions, or a visitor who asked for less motion, gets the switch
 * with no animation. And a slow request must never leave the page frozen on its snapshot.
 */

type UpdateCallback = () => Promise<void> | void;

let startViewTransition: ReturnType<typeof vi.fn>;
let updateDone: Promise<void> | void;
let reducedMotion = false;

beforeEach(() => {
    reducedMotion = false;
    updateDone = undefined;
    startViewTransition = vi.fn((update: UpdateCallback) => {
        updateDone = update();
        return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, writable: true, value: startViewTransition });
    window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion') && reducedMotion,
        media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
    vi.useRealTimers();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
});

/** Resolves true if the promise settled, false if it is still pending. */
async function settled(p: Promise<void> | void): Promise<boolean> {
    let done = false;
    void Promise.resolve(p).then(() => { done = true; });
    await Promise.resolve(); await Promise.resolve();
    return done;
}

describe('switchLocale', () => {
    it('switches inside a view transition, so the old page is captured first', () => {
        const navigate = vi.fn();

        switchLocale('ko', navigate);

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(navigate).toHaveBeenCalledOnce();
    });

    it('holds the fade until the new language has rendered', async () => {
        switchLocale('ko', vi.fn());

        expect(await settled(updateDone)).toBe(false);

        markLocaleRendered('ko');
        expect(await settled(updateDone)).toBe(true);
    });

    it('is not released by a render of some other language', async () => {
        switchLocale('ko', vi.fn());

        markLocaleRendered('en');
        expect(await settled(updateDone)).toBe(false);
    });

    it('never leaves the page frozen when the new language is slow to arrive', async () => {
        vi.useFakeTimers();
        switchLocale('ko', vi.fn());

        vi.advanceTimersByTime(LOCALE_TRANSITION_TIMEOUT_MS - 1);
        expect(await settled(updateDone)).toBe(false);

        vi.advanceTimersByTime(1);
        expect(await settled(updateDone)).toBe(true);
    });

    it('switches without animation for a visitor who asked for less motion', () => {
        reducedMotion = true;
        const navigate = vi.fn();

        switchLocale('ko', navigate);

        expect(startViewTransition).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledOnce();
    });

    it('switches without animation where the browser has no view transitions', () => {
        delete (document as { startViewTransition?: unknown }).startViewTransition;
        const navigate = vi.fn();

        switchLocale('ko', navigate);

        expect(navigate).toHaveBeenCalledOnce();
    });
});
