'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ACCENT_FILL, type Palette } from '../lib/palette';

/**
 * The one floating panel every checkout picker opens — the date picker, the dropdowns, the
 * phone's dial codes — so they read as one set of controls rather than three: the same plate,
 * corners and shadow, the same rounded options with the chosen one in the brand gradient, the
 * same hover, and Escape or a click outside to close.
 *
 * Placed under its field (the caller's wrapper, which is `position: relative`), but drawn at the
 * top of the page, a portal into `document.body`, above every control that floats over the page.
 * Drawn inside the field it was not: on a phone the support chat button and the brand preview
 * switcher float 92px up from the bottom of the screen, above the panel's old z-index of 41, so
 * the lower rows of a calendar opened in the bottom half of the screen sat under them, and a tap
 * there reached the button rather than the date. Raising the z-index alone did not hold: after
 * a step change the step's slide-in animation makes its content a layer of its own, and nothing
 * inside that layer can be lifted above what floats outside it.
 */
export function PickerPanel({
    palette, role, labelledBy, onClose, width = 304, children,
}: {
    palette:    Palette;
    /** `dialog` for a panel with its own controls (the calendar); omit for one holding a listbox. */
    role?:      'dialog';
    labelledBy: string;
    onClose:    () => void;
    width?:     number;
    children:   React.ReactNode;
}) {
    /** A marker left where the panel used to be drawn, so it can find the field it belongs to. */
    const anchorRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Positioned before the first paint, from the field's place on the page: in page
    // coordinates, so it scrolls with the page as it did when it was drawn inside the field.
    useLayoutEffect(() => {
        const place = () => {
            const field = anchorRef.current?.parentElement;
            const panel = panelRef.current;
            if (!field || !panel) return;
            const rect = field.getBoundingClientRect();
            // Level with the field's left edge, unless that runs it off the right of the screen:
            // a field on the right of a narrow row (a filter's "to" time) opens it leftwards.
            const screen = document.documentElement.clientWidth;
            const left = screen > 0
                ? Math.max(16, Math.min(rect.left, screen - panel.offsetWidth - 16))
                : rect.left;
            panel.style.top = `${rect.bottom + window.scrollY + 8}px`;
            panel.style.left = `${left + window.scrollX}px`;
        };
        place();
        // A calendar opened low on a phone ran off the bottom of the screen. Bring it all into
        // view. Not a listbox: its field keeps the focus and the keyboard, and scrolling for the
        // list could push the field it is being typed into off the top.
        if (role === 'dialog') panelRef.current?.scrollIntoView?.({ block: 'nearest' });
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [role]);

    return (
        <>
            <PickerStyles palette={palette} />
            <span ref={anchorRef} aria-hidden style={{ display: 'none' }} />
            {createPortal(
                <>
                    {/* Above the floating controls (chat 50, brand preview 70, the bottom nav's 100–102),
                        below the install prompt's modal (9998). */}
                    <div data-testid="picker-backdrop" data-picker-layer onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
                    <div
                        ref={panelRef}
                        data-picker-layer
                        className="cg-picker-panel"
                        role={role}
                        aria-labelledby={role ? labelledBy : undefined}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
                            // Drawn at the end of the page, Tab would carry on out of the form from
                            // here. Close instead: the picker hands focus back to its field, and Tab
                            // moves on from there to the next one, as it would from a native select.
                            if (e.key === 'Tab') onClose();
                        }}
                        style={{
                            position: 'absolute', top: 0, left: 0, zIndex: 201,
                            // At least `--cg-picker-min` wide (360px on a phone, see globals.css), never wider than the screen.
                            width: `min(max(${width}px, var(--cg-picker-min, 0px)), calc(100vw - 32px))`, padding: 14, borderRadius: 18,
                            background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`,
                            boxShadow: '0 18px 44px rgba(2,6,23,.45)', color: palette.text,
                        }}
                    >
                        {children}
                    </div>
                </>,
                document.body,
            )}
        </>
    );
}

/**
 * Whether an event happened in an open picker — its panel or the backdrop behind it. Drawn at
 * the top of the page, outside the popover that opened it, a picker inside a popover that
 * closes on a click outside itself (the search bar's travellers) must be let through by it.
 */
export function isInPickerLayer(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[data-picker-layer]') !== null;
}

/** How an option looks: a pill, the chosen one filled with the brand gradient. */
export function pickStyle(palette: Palette, { selected = false, disabled = false, ring = false } = {}): React.CSSProperties {
    return {
        border: 'none', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--cg-pick-fs)',
        fontWeight: selected ? 700 : 500,
        color: selected ? '#fff' : palette.text,
        background: selected ? ACCENT_FILL : 'transparent',
        boxShadow: ring && !selected ? `inset 0 0 0 1px ${palette.icon}` : 'none',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'default' : 'pointer',
    };
}

/** The panel's hover and keyboard-focus states, which inline styles cannot express. */
function PickerStyles({ palette }: { palette: Palette }) {
    return (
        <style>{`
            .cg-pick:not(:disabled):not([aria-pressed="true"]):not([aria-selected="true"]):hover,
            .cg-pick-title:hover, .cg-pick-nav:not(:disabled):hover { background: ${palette.stepIdle} !important; }
            .cg-pick:focus-visible, .cg-pick-title:focus-visible, .cg-pick-nav:focus-visible { outline: 2px solid ${palette.icon}; outline-offset: 2px; }
        `}</style>
    );
}
