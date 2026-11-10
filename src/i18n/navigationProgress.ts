/**
 * Whether the app is on its way to another page, for the bar across the top of the screen.
 *
 * The App Router keeps the old page on screen until the new one is ready and says nothing in
 * between, so a tap that starts a slow navigation — a page the server has to render, a phone on
 * a slow network, a route the dev server is still compiling — looks like a tap that missed. It
 * has no event for "a navigation started" either. So the start is reported here by what starts
 * one: the app's `Link` and `useRouter` (./navigation), and the browser's back and forward
 * (`NavigationProgress`, which also ends it once the new pathname renders).
 *
 * Only a move to another page counts. A page that rewrites its own query — a new search, a
 * filter, a currency — stays on screen and shows its own loading; a language switch has its
 * cross-fade (./localeTransition).
 */

export type NavigationPhase = 'idle' | 'loading';

let phase: NavigationPhase = 'idle';
const listeners = new Set<() => void>();

function enter(next: NavigationPhase): void {
    if (phase === next) return;
    phase = next;
    listeners.forEach((listener) => listener());
}

export function startNavigation(): void {
    enter('loading');
}

export function finishNavigation(): void {
    enter('idle');
}

export function getNavigationPhase(): NavigationPhase {
    return phase;
}

export function subscribeNavigation(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

type Here = Pick<Location, 'href' | 'pathname' | 'origin'>;

/** Whether `href` is another page of this site than the one at `from` — its pathname, not its query or hash. */
export function leavesPage(href: string, from: Here = window.location): boolean {
    let url: URL;
    try {
        url = new URL(href, from.href);
    } catch {
        return false;
    }
    return url.origin === from.origin && url.pathname !== from.pathname;
}
