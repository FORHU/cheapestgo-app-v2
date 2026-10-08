'use client';

import type { DistanceUnit } from '@/shared/lib/distance';

export interface DistanceUnitToggleColors {
    muted: string;
    border: string;
    activeBg: string;
    activeFg: string;
}

interface DistanceUnitToggleProps {
    value: DistanceUnit;
    onChange: (unit: DistanceUnit) => void;
    /** Accessible name for the group, e.g. "Distance unit". */
    label: string;
    /** Taken from the caller's palette, so the pill sits in whatever theme its page draws. */
    colors: DistanceUnitToggleColors;
}

const UNITS: readonly DistanceUnit[] = ['km', 'mi'];

/** km | mi. The abbreviations read the same in every language the site serves, so they are not translated. */
export function DistanceUnitToggle({ value, onChange, label, colors }: DistanceUnitToggleProps) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 999, border: `1px solid ${colors.border}` }}
        >
            {UNITS.map((unit) => {
                const active = unit === value;
                return (
                    <button
                        key={unit}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { if (!active) onChange(unit); }}
                        style={{
                            padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                            background: active ? colors.activeBg : 'transparent',
                            color: active ? colors.activeFg : colors.muted,
                            transition: 'background .15s, color .15s',
                        }}
                    >
                        {unit}
                    </button>
                );
            })}
        </div>
    );
}
