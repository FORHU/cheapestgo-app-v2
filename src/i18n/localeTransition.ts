/**
 * Changing language as a cross-fade: the old page dissolves into the new one.
 *
 * Uses the browser's view transitions. `startViewTransition` snapshots the page as it is, runs
 * the update, and fades to whatever is on screen once the update says it is done — so "done"
 * has to mean the new language has rendered, not that the navigation was asked for. The switch
 * is a client-side navigation that lands a round trip later; `HtmlLang` reports when the new
 * locale has committed, through `markLocaleRendered`.
 *
 * Until then the browser holds the old snapshot and the page does not respond, so the wait is
 * capped: a slow request ends the hold at the timeout and the page carries on without the fade.
 *
 * No transition where the browser has none, or for a visitor who asked for less motion — both
 * get the same switch, just without the animation.
 */

export const LOCALE_TRANSITION_TIMEOUT_MS = 1500;

/** The switch in flight, if any: the locale it is waiting for, and how to end the hold. */
let pending: { locale: string; release: () => void } | null = null;

export function switchLocale(next: string, navigate: () => void): void {
    const start = typeof document !== 'undefined' ? document.startViewTransition?.bind(document) : undefined;
    const lessMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!start || lessMotion) {
        navigate();
        return;
    }

    start(() => new Promise<void>((resolve) => {
        const timer = setTimeout(release, LOCALE_TRANSITION_TIMEOUT_MS);
        function release() {
            clearTimeout(timer);
            if (pending?.release === release) pending = null;
            resolve();
        }
        // A second pick before the first landed: the browser abandons the first transition for
        // the new one, so its hold is ended here rather than left to the timer.
        pending?.release();
        pending = { locale: next, release };
        navigate();
    }));
}

/** Called once a locale has rendered. Ends the hold if that is the locale being switched to. */
export function markLocaleRendered(locale: string): void {
    if (pending?.locale === locale) pending.release();
}
