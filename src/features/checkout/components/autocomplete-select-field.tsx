'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Palette } from '../lib/palette';
import { PickerPanel, pickStyle } from './picker-panel';
import type { SelectOption } from './select-field';

export function AutocompleteSelectField({
    id, value, options, placeholder, noResults, onChange, palette, style, className,
}: {
    id:          string;
    value:       string;
    options:     SelectOption[];
    placeholder: string;
    noResults:   string;
    onChange:    (value: string) => void;
    palette:     Palette;
    style?:      React.CSSProperties;
    className?:  string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const chosen = options.find((option) => option.value === value);
    const filteredOptions = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return search
            ? options.filter((option) => option.label.toLocaleLowerCase().includes(search)
                || option.value.toLocaleLowerCase().includes(search))
            : options;
    }, [options, query]);

    const close = () => {
        setOpen(false);
        setQuery('');
    };
    const startEditing = () => {
        if (!open) {
            setQuery('');
            setActive(0);
            setOpen(true);
        }
    };
    const pick = (option: SelectOption) => {
        onChange(option.value);
        close();
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && open) {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, filteredOptions.length - 1));
        } else if (event.key === 'ArrowUp' && open) {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (filteredOptions[active]) pick(filteredOptions[active]);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={`${id}-listbox`}
                    aria-activedescendant={open && filteredOptions[active] ? `${id}-option-${active}` : undefined}
                    autoComplete="off"
                    value={open ? query : chosen?.label ?? ''}
                    placeholder={placeholder}
                    onClick={startEditing}
                    onFocus={startEditing}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    className={className}
                    style={{ ...style, paddingRight: 40 }}
                />
                <ChevronDown size={16} color={palette.icon} aria-hidden="true"
                    style={{ position: 'absolute', right: 16, top: '50%', pointerEvents: 'none',
                        transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                        transition: 'transform .15s ease' }} />
            </div>
            {open && (
                <PickerPanel palette={palette} labelledBy={id} onClose={close} width={304}>
                    <div id={`${id}-listbox`} role="listbox" aria-labelledby={id}
                        style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                        {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
                            <button
                                id={`${id}-option-${index}`}
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                tabIndex={-1}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => pick(option)}
                                className="cg-pick"
                                style={{ ...pickStyle(palette, {
                                    selected: option.value === value,
                                    ring: index === active && option.value !== value,
                                }), width: '100%', padding: '9px 14px', textAlign: 'left', fontSize: 14 }}
                            >
                                {option.label}
                            </button>
                        )) : (
                            <div role="status" style={{ padding: '10px 14px', fontSize: 13, color: palette.muted }}>
                                {noResults}
                            </div>
                        )}
                    </div>
                </PickerPanel>
            )}
        </div>
    );
}
