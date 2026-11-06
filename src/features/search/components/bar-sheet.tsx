'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { sortPalette } from './search-chrome';

/** Below this a search bar's panel opens as a sheet; from `md` up it hangs under its button. */
const SHEET_QUERY = '(max-width: 767px)';

/**
 * Whether a panel opening now should be a sheet. Asked when it opens, not on render: no panel
 * is open on the server, so there is nothing to hydrate, and a panel's life is too short for a
 * rotation to matter. False where there is no `matchMedia` (jsdom), so tests get the popover.
 */
export const opensAsSheet = () => typeof window !== 'undefined' && !!window.matchMedia?.(SHEET_QUERY).matches;

/**
 * A search bar's panel on a phone: a sheet along the bottom of the screen, over everything.
 *
 * The popover it replaces there hung off its button with `right: 0`, and on a narrow phone the
 * button wraps to the left edge of the bar, so the panel opened off the left of the screen with
 * only its last column showing. Docked to the screen instead, it cannot land anywhere but on it,
 * and it sits above the bottom nav and the floating buttons rather than among them.
 *
 * Rendered into `<body>`, so the caller's outside-press handler has to count a press in
 * `sheetRef` as inside. A press on the backdrop is outside, which is how it closes; Escape is the
 * caller's, as it is for the popover.
 *
 * `footer` — the panel's Done — is pinned under the scrolling body rather than at its end: the
 * flight editor (trip type, calendar, travellers, cabin) is taller than a phone, and a Done you
 * have to scroll down to find is a Done you do not know is there.
 */
export function BarSheet({
    open, title, tone, onClose, sheetRef, children, footer,
}: {
    open: boolean;
    title: string;
    tone: 'light' | 'dark';
    onClose: () => void;
    sheetRef: React.RefObject<HTMLDivElement>;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const tAll = useTranslations();
    const p = sortPalette(tone);
    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {/* `touch-action: none`: a drag on the dimmed page would pan the map under it. */}
                    <motion.div
                        key="backdrop"
                        aria-hidden
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[129] bg-black/45"
                        style={{ touchAction: 'none' }}
                    />
                    <motion.div
                        key="sheet"
                        ref={sheetRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                        // Above the bottom nav (z-100), its own settings sheet and every floating button.
                        className="fixed inset-x-0 bottom-0 z-[130] flex max-h-[min(90dvh,calc(100dvh-48px))] flex-col rounded-t-[24px]"
                        style={{ background: p.menu, color: p.text, border: `1px solid ${p.border}`, borderBottom: 'none', boxShadow: p.shadow }}
                    >
                        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full" style={{ background: p.border }} />
                        <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-1">
                            <h2 style={{ fontSize: 17, fontWeight: 700 }}>{title}</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label={tAll('common.close')}
                                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full cursor-pointer transition-colors"
                                style={{ color: p.text }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {/* `overscroll-behavior: contain` keeps a scroll that runs off the end of the
                            sheet from carrying on into the page under it. */}
                        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 ${footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom,0px)+20px)]'}`}>
                            {children}
                        </div>
                        {footer && (
                            <div
                                className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"
                                style={{ borderTop: `1px solid ${p.border}` }}
                            >
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
