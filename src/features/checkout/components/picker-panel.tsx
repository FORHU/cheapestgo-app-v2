'use client';

import React from 'react';
import { ACCENT_FILL, type Palette } from '../lib/palette';

/**
 * The one floating panel every checkout picker opens — the date picker, the dropdowns, the
 * phone's dial codes — so they read as one set of controls rather than three: the same plate,
 * corners and shadow, the same rounded options with the chosen one in the brand gradient, the
 * same hover, and Escape or a click outside to close.
 *
 * Positioned under its field; the caller's wrapper is `position: relative`.
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
    return (
        <>
            <PickerStyles palette={palette} />
            <div data-testid="picker-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div
                className="cg-picker-panel"
                role={role}
                aria-labelledby={role ? labelledBy : undefined}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
                style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 41,
                    width: `min(${width}px, calc(100vw - 32px))`, padding: 14, borderRadius: 18,
                    background: palette.menuBg, border: `1px solid ${palette.summaryBorder}`,
                    boxShadow: '0 18px 44px rgba(2,6,23,.45)', color: palette.text,
                }}
            >
                {children}
            </div>
        </>
    );
}

/** How an option looks: a pill, the chosen one filled with the brand gradient. */
export function pickStyle(palette: Palette, { selected = false, disabled = false, ring = false } = {}): React.CSSProperties {
    return {
        border: 'none', borderRadius: 999, fontFamily: 'inherit', fontSize: 13,
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
