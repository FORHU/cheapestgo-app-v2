'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BRAND } from '@/shared/lib/palette';
import {
    finishNavigation,
    getNavigationPhase,
    startNavigation,
    subscribeNavigation,
} from '@/i18n/navigationProgress';

/**
 * The bar across the top of the screen between a tap and the page it asked for.
 *
 * The App Router leaves the old page up, unchanged, until the next one is ready — on a phone, on
 * a slow network, that is a tap with no answer. This answers it: the bar sets off the moment a
 * navigation is reported (./navigationProgress), creeps on without ever reaching the end, and
 * fills and fades once the new page has rendered.
 *
 * The start comes from the app's Link and useRouter, and from here for the browser's back and
 * forward — on a phone, the edge swipe — which it sees as a popstate to another pathname. The
 * end is the pathname changing. One that never changes (a navigation cancelled by another to the
 * page already on screen) would leave the bar creeping forever, so it gives up after a while.
 *
 * Above everything, the pickers' panels included, and below the status bar where the installed
 * app draws under it. It takes no taps.
 */

export const NAVIGATION_PROGRESS_TIMEOUT_MS = 15_000;

/** How long the filled bar takes to fade once the page has arrived. */
const LEAVE_MS = 450;

type Bar = 'hidden' | 'start' | 'creep' | 'done';

const STYLE: Record<Exclude<Bar, 'hidden'>, React.CSSProperties> = {
    start: { transform: 'scaleX(0.08)', opacity: 1, transition: 'none' },
    // Quick off the mark, then slower and slower: most pages land in the first second.
    creep: { transform: 'scaleX(0.85)', opacity: 1, transition: 'transform 8s cubic-bezier(0.1, 0.7, 0.2, 1)' },
    done: { transform: 'scaleX(1)', opacity: 0, transition: 'transform 200ms ease-out, opacity 250ms ease 200ms' },
};

/** For a visitor who asked for less motion: the whole bar, there or not, with no sweep. */
const STILL: Record<Exclude<Bar, 'hidden'>, React.CSSProperties> = {
    start: { transform: 'scaleX(1)', opacity: 1, transition: 'none' },
    creep: { transform: 'scaleX(1)', opacity: 1, transition: 'none' },
    done: { transform: 'scaleX(1)', opacity: 0, transition: 'opacity 200ms ease' },
};

export function NavigationProgress() {
    const t = useTranslations('common');
    const phase = React.useSyncExternalStore(subscribeNavigation, getNavigationPhase, () => 'idle' as const);
    const pathname = usePathname();
    const rendered = React.useRef(pathname);
    const element = React.useRef<HTMLDivElement>(null);
    const [bar, setBar] = React.useState<Bar>('hidden');

    // The page asked for has rendered.
    React.useEffect(() => {
        rendered.current = pathname;
        finishNavigation();
    }, [pathname]);

    // Back and forward. The address has already changed when this fires; the page has not.
    React.useEffect(() => {
        const onPopState = () => {
            if (window.location.pathname !== rendered.current) startNavigation();
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    React.useEffect(() => {
        if (phase === 'loading') {
            setBar('start');
            const giveUp = setTimeout(finishNavigation, NAVIGATION_PROGRESS_TIMEOUT_MS);
            return () => clearTimeout(giveUp);
        }
        setBar((current) => (current === 'hidden' ? current : 'done'));
    }, [phase]);

    // Lay the bar out at its start before it creeps, or there is nothing for the creep to run from.
    React.useLayoutEffect(() => {
        if (bar !== 'start') return;
        void element.current?.offsetWidth;
        setBar('creep');
    }, [bar]);

    React.useEffect(() => {
        if (bar !== 'done') return;
        const leave = setTimeout(() => setBar('hidden'), LEAVE_MS);
        return () => clearTimeout(leave);
    }, [bar]);

    if (bar === 'hidden') return null;

    const lessMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return (
        <div
            ref={element}
            role="progressbar"
            aria-label={t('loadingPage')}
            aria-hidden={bar === 'done' || undefined}
            className="pointer-events-none fixed inset-x-0 z-[300] h-[3px] origin-left"
            style={{
                top: 'env(safe-area-inset-top, 0px)',
                background: BRAND.gradient,
                boxShadow: '0 0 8px rgba(37,99,235,0.45)',
                ...(lessMotion ? STILL : STYLE)[bar],
            }}
        />
    );
}
