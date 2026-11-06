'use client';

/**
 * The checkout's dialog: what a warning that stops the flow is shown in.
 *
 * An `alertdialog` — announced as it opens, focus moved into it — that closes on Escape, on its
 * backdrop, or on its own buttons, keeps Tab inside, stops the page behind from scrolling, and
 * hands focus back when it goes. A sheet from the bottom on a phone, centred above that.
 *
 * Rendered into `document.body`: the checkout slides its steps in with a transform, and a
 * `position: fixed` element inside a transformed ancestor is fixed to that ancestor, not the screen.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Palette } from '../lib/palette';

export function CheckoutDialog({
    palette, labelledBy, describedBy, onClose, initialFocusRef, returnFocusRef, children,
}: {
    palette:     Palette;
    /** The id of the dialog's title. */
    labelledBy:  string;
    /** The id of what it says. */
    describedBy: string;
    onClose:     () => void;
    /** What has focus once it opens: its main action, so Enter or a tap answers it. */
    initialFocusRef: React.RefObject<HTMLElement | null>;
    /** Where focus goes once it closes. Without it, whatever had focus when it opened. */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
    children:    React.ReactNode;
}) {
    const dialogRef = useRef<HTMLDivElement>(null);
    // Read through a ref, so a fresh callback from the page does not re-run the setup below
    // (and bounce focus) on every render while the dialog is open.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    // Once per opening: Escape closes, Tab stays inside, the page behind does not scroll, and
    // focus goes back (to `returnFocusRef`, or whatever had it) once the dialog is gone.
    useEffect(() => {
        const returnTo = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
        initialFocusRef.current?.focus();
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const items = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            returnTo?.focus?.();
        };
    }, [initialFocusRef, returnFocusRef]);

    // z-110: over the phone's bottom nav (100) and the sheet it opens (101-102), so the dialog
    // never depends on landing later in the document to win a tie with them.
    return createPortal(
        <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                className="w-full rounded-t-3xl p-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-7"
                style={{ background: palette.menuBg, border: `1px solid ${palette.cardLine}`, color: palette.text }}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

/** The dialog's buttons and links: a pill, the main one in the brand gradient. */
export const DIALOG_ACTION: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 22px', borderRadius: 999, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};

/** A ring a keyboard can see on every action, whatever the pill's own colours. */
export const DIALOG_FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';
