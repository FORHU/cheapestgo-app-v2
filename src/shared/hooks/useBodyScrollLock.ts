import { useEffect } from 'react';

let locks = 0;
let saved = '';

/**
 * Stops the page scrolling behind an overlay. Reference-counted, so overlays that open and close
 * independently (a popup over a fullscreen view) never restore each other's stale value: the first
 * lock saves the original `overflow`, the last release puts it back.
 */
export function useBodyScrollLock(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        if (locks === 0) {
            saved = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        locks++;
        return () => {
            locks--;
            if (locks === 0) document.body.style.overflow = saved;
        };
    }, [active]);
}
