'use client';

import { useEffect, useState } from 'react';

/** Less than this between the layout and the visual viewport is a browser toolbar settling, not a keyboard. */
const MIN_KEYBOARD_PX = 80;

export interface KeyboardInset {
    /** How much of the foot of the layout viewport the on-screen keyboard covers, in px; 0 when it is closed. */
    inset: number;
    /** The height still visible above the keyboard while it is open; null when it is closed. */
    visibleHeight: number | null;
}

const CLOSED: KeyboardInset = { inset: 0, visibleHeight: null };

/**
 * Where the on-screen keyboard is, for something docked to the bottom of the screen.
 *
 * A `fixed; bottom: 0` sheet is placed against the layout viewport, which an on-screen keyboard
 * does not resize: not in iOS Safari, and not in Chrome for Android, whose default since 108 is to
 * shrink only the visual viewport. So the keyboard came up over the sheet, and the field and the
 * results under it went behind it, past where the sheet could scroll. `100dvh` does not move for
 * the keyboard either. The visual viewport does, so a sheet sits on `inset` and caps itself to
 * `visibleHeight` instead.
 *
 * Only listens while `active`, the sheet being open. Pinch zoom also shrinks the visual viewport;
 * a zoomed page reports no keyboard rather than a sheet jumping up the screen.
 */
export function useKeyboardInset(active = true): KeyboardInset {
    const [state, setState] = useState<KeyboardInset>(CLOSED);

    useEffect(() => {
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (!active || !vv) { setState(CLOSED); return; }

        const read = () => {
            const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
            const open = vv.scale <= 1.01 && covered >= MIN_KEYBOARD_PX;
            setState(prev => {
                const next = open ? { inset: covered, visibleHeight: Math.round(vv.height) } : CLOSED;
                return prev.inset === next.inset && prev.visibleHeight === next.visibleHeight ? prev : next;
            });
        };
        read();
        // `scroll` too: iOS pans the visual viewport to the focused field as the keyboard rises.
        vv.addEventListener('resize', read);
        vv.addEventListener('scroll', read);
        return () => {
            vv.removeEventListener('resize', read);
            vv.removeEventListener('scroll', read);
        };
    }, [active]);

    return state;
}
