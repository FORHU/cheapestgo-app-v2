'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Palette } from '../lib/palette';
import { PickerPanel, pickStyle } from './picker-panel';

export interface SelectOption {
    value:    string;
    /** What the field shows once chosen, and the option's accessible name. */
    label:    string;
    /** What the option shows in the list, when that is more than its label (a flag, a code). */
    content?: React.ReactNode;
}

/**
 * The options of a dropdown, in the checkout's picker panel: a listbox the arrow keys walk,
 * Home and End jump, and Enter or a click chooses from. Focus starts on the chosen option.
 * Shared by SelectField and the phone field's dial codes.
 */
export function OptionList({
    labelledBy, options, value, onPick, onClose, palette, width,
}: {
    labelledBy: string;
    options:    SelectOption[];
    value:      string;
    onPick:     (value: string) => void;
    onClose:    () => void;
    palette:    Palette;
    width?:     number;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));

    useEffect(() => {
        listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[active]?.focus();
    }, [active]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        const last = options.length - 1;
        const next = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last }[e.key];
        if (next !== undefined) { e.preventDefault(); setActive(next); }
    };

    return (
        <PickerPanel palette={palette} labelledBy={labelledBy} onClose={onClose} width={width}>
            <div ref={listRef} role="listbox" aria-labelledby={labelledBy} tabIndex={-1} onKeyDown={onKeyDown}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                {options.map((o, i) => {
                    const selected = o.value === value;
                    return (
                        <button key={`${o.value}-${i}`} type="button" role="option" aria-selected={selected}
                            aria-label={o.content ? undefined : o.label}
                            tabIndex={i === active ? 0 : -1}
                            onClick={() => onPick(o.value)} className="cg-pick"
                            style={{ ...pickStyle(palette, { selected }), display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: 'var(--cg-option-py) 14px', textAlign: 'left', fontSize: 'var(--cg-field-fs)' }}>
                            {o.content ?? o.label}
                        </button>
                    );
                })}
            </div>
        </PickerPanel>
    );
}

/**
 * A dropdown in the checkout's look, in place of the browser's `<select>` — whose menu is drawn
 * by the operating system, in its colours, and cannot match the date picker beside it.
 */
export function SelectField({
    id, value, options, placeholder, onChange, palette, style, className, ariaLabel, panelWidth = 260, chevronSize = 16,
}: {
    /** For the `<label htmlFor>` that names it. */
    id:          string;
    value:       string;
    options:     SelectOption[];
    placeholder: string;
    onChange:    (value: string) => void;
    palette:     Palette;
    /** The field's own look — the page's, so it matches the inputs beside it. */
    style?:      React.CSSProperties;
    className?:  string;
    /** Its name where no `<label>` gives it one. */
    ariaLabel?:  string;
    /** The panel's width; a phone widens it to `--cg-picker-min` for the fingers. */
    panelWidth?: number;
    /** For a field smaller than a form's. */
    chevronSize?: number;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const chosen = options.find((o) => o.value === value);
    const close = () => { setOpen(false); triggerRef.current?.focus(); };

    return (
        <div style={{ position: 'relative' }}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel ? `${ariaLabel}: ${chosen?.label ?? placeholder}` : undefined}
                onClick={() => (open ? close() : setOpen(true))}
                className={className}
                style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer' }}
            >
                <span style={{ color: chosen ? palette.text : palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chosen?.label ?? placeholder}
                </span>
                <ChevronDown size={chevronSize} color={palette.icon} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
            </button>
            {open && (
                <OptionList
                    labelledBy={id}
                    options={options}
                    value={value}
                    onPick={(v) => { onChange(v); close(); }}
                    onClose={close}
                    palette={palette}
                    width={panelWidth}
                />
            )}
        </div>
    );
}
