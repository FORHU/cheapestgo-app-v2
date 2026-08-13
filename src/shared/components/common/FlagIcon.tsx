import React from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * The handful of flags the header menus need, drawn inline.
 *
 * Emoji flags are not an option here: Windows ships no regional-indicator
 * glyphs, so `🇰🇷` renders as the letters "KR" for a large slice of users.
 * These are simplified at the ~22px they are shown at — the shapes read, the
 * star counts do not.
 */

export type FlagCode = 'US' | 'KR' | 'JP' | 'CN';

/** Points for a five-pointed star, `rotation` in degrees (-90 points it up). */
function star(cx: number, cy: number, r: number, rotation = -90): string {
    const points: string[] = [];
    for (let i = 0; i < 5; i++) {
        const outer = ((rotation + i * 72) * Math.PI) / 180;
        const inner = ((rotation + i * 72 + 36) * Math.PI) / 180;
        points.push(`${(cx + r * Math.cos(outer)).toFixed(2)},${(cy + r * Math.sin(outer)).toFixed(2)}`);
        points.push(`${(cx + r * 0.382 * Math.cos(inner)).toFixed(2)},${(cy + r * 0.382 * Math.sin(inner)).toFixed(2)}`);
    }
    return points.join(' ');
}

const STRIPE = 20 / 13;

/** The four trigrams: corner, tilt, and which of the three bars are unbroken. */
const KR_TRIGRAMS: Array<{ x: number; y: number; rot: number; solid: [boolean, boolean, boolean] }> = [
    { x: 6, y: 4.4, rot: -56.31, solid: [true, true, true] },     // ☰ geon
    { x: 24, y: 4.4, rot: 56.31, solid: [false, true, false] },   // ☵ gam
    { x: 6, y: 15.6, rot: 56.31, solid: [true, false, true] },    // ☲ ri
    { x: 24, y: 15.6, rot: -56.31, solid: [false, false, false] },// ☷ gon
];

const FLAGS: Record<FlagCode, React.ReactNode> = {
    US: (
        <>
            <rect width="30" height="20" fill="#fff" />
            {[0, 2, 4, 6, 8, 10, 12].map((i) => (
                <rect key={i} y={i * STRIPE} width="30" height={STRIPE} fill="#B22234" />
            ))}
            <rect width="12" height={STRIPE * 7} fill="#3C3B6E" />
            {Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) => (
                    <circle
                        key={`${row}-${col}`}
                        cx={1.2 + col * 2 + (row % 2) * 1}
                        cy={1.1 + row * 2.1}
                        r="0.42"
                        fill="#fff"
                    />
                ))
            )}
        </>
    ),
    KR: (
        <>
            <rect width="30" height="20" fill="#fff" />
            <g transform="rotate(-33.69 15 10)">
                <circle cx="15" cy="10" r="5" fill="#0047A0" />
                <path d="M10 10A5 5 0 0 1 20 10A2.5 2.5 0 0 0 15 10A2.5 2.5 0 0 1 10 10Z" fill="#CD2E3A" />
            </g>
            {KR_TRIGRAMS.map((t, i) => (
                <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`} fill="#000">
                    {t.solid.map((isSolid, row) =>
                        isSolid ? (
                            <rect key={row} x="-2.6" y={-1.9 + row * 1.5} width="5.2" height="0.9" />
                        ) : (
                            <React.Fragment key={row}>
                                <rect x="-2.6" y={-1.9 + row * 1.5} width="2.2" height="0.9" />
                                <rect x="0.4" y={-1.9 + row * 1.5} width="2.2" height="0.9" />
                            </React.Fragment>
                        )
                    )}
                </g>
            ))}
        </>
    ),
    JP: (
        <>
            <rect width="30" height="20" fill="#fff" />
            <circle cx="15" cy="10" r="6" fill="#BC002D" />
        </>
    ),
    CN: (
        <>
            <rect width="30" height="20" fill="#DE2910" />
            <polygon points={star(5.5, 5.5, 3.2)} fill="#FFDE00" />
            <polygon points={star(10.9, 2.2, 1.1, -50)} fill="#FFDE00" />
            <polygon points={star(12.9, 4.6, 1.1, -70)} fill="#FFDE00" />
            <polygon points={star(12.9, 7.6, 1.1, -110)} fill="#FFDE00" />
            <polygon points={star(10.9, 10, 1.1, -130)} fill="#FFDE00" />
        </>
    ),
};

const FLAG_LABELS: Record<FlagCode, string> = {
    US: 'United States',
    KR: 'South Korea',
    JP: 'Japan',
    CN: 'China',
};

interface FlagIconProps {
    code: FlagCode;
    /** Sizing/shape overrides; defaults to the 22×15 chip the header menus use. */
    className?: string;
}

export function FlagIcon({ code, className }: FlagIconProps) {
    return (
        <span
            className={cn(
                'inline-flex h-[15px] w-[22px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-inset ring-black/10 dark:ring-white/15',
                className
            )}
        >
            <svg
                viewBox="0 0 30 20"
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full"
                role="img"
                aria-label={FLAG_LABELS[code]}
            >
                {FLAGS[code]}
            </svg>
        </span>
    );
}

export default FlagIcon;
