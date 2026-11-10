import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    startNavigation,
    finishNavigation,
    getNavigationPhase,
    subscribeNavigation,
    leavesPage,
} from '../navigationProgress';

/**
 * Whether the app is on its way to another page — reported by whatever starts the move, ended
 * by the new page rendering — and the one question every start asks first: is this another page?
 */

const ON_DEALS = { href: 'http://localhost:3000/deals?sort=price', pathname: '/deals', origin: 'http://localhost:3000' };

afterEach(() => finishNavigation());

describe('the navigation phase', () => {
    it('is idle until a navigation starts, and idle again once it finishes', () => {
        expect(getNavigationPhase()).toBe('idle');
        startNavigation();
        expect(getNavigationPhase()).toBe('loading');
        finishNavigation();
        expect(getNavigationPhase()).toBe('idle');
    });

    it('tells its listeners when it changes, and only then', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeNavigation(listener);
        startNavigation();
        startNavigation();
        expect(listener).toHaveBeenCalledTimes(1);
        finishNavigation();
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        startNavigation();
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('leavesPage', () => {
    it('is another page when the pathname differs', () => {
        expect(leavesPage('/trips', ON_DEALS)).toBe(true);
        expect(leavesPage('http://localhost:3000/ko/deals', ON_DEALS)).toBe(true);
    });

    it('is the same page when only the query or the hash differs', () => {
        expect(leavesPage('/deals?sort=rating', ON_DEALS)).toBe(false);
        expect(leavesPage('?currency=KRW', ON_DEALS)).toBe(false);
        expect(leavesPage('#reviews', ON_DEALS)).toBe(false);
        expect(leavesPage('/deals#reviews', ON_DEALS)).toBe(false);
    });

    it('is not a page of this site when it is on another origin', () => {
        expect(leavesPage('https://example.com/trips', ON_DEALS)).toBe(false);
        expect(leavesPage('mailto:help@example.com', ON_DEALS)).toBe(false);
    });
});
