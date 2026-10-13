import React from 'react';

/** Height of the stub below the tear line, and the notch radius bitten into it. */
export const STUB_H = 56;
const NOTCH_R = 11;

/**
 * Two half-width background layers, each with a notch cut out of its own edge at
 * the tear line. The notches are painted as background rather than masked out of
 * the card because the field dropdowns overflow the card — a mask would clip
 * them, a background layer leaves them alone.
 *
 * The card sets `--ticket-bg` to its own surface colour, so the notches read as
 * holes punched through to the page behind.
 */
const notch = (edge: 'left' | 'right') =>
    `radial-gradient(circle at ${edge === 'left' ? '0' : '100%'} calc(100% - ${STUB_H}px),` +
    ` transparent ${NOTCH_R}px, var(--ticket-bg) ${NOTCH_R + 0.5}px) ${edge} / 50.5% 100% no-repeat`;

/** Spread onto the card's `style`. The card must also be `relative`. */
export const TICKET_SURFACE: React.CSSProperties = {
    background: `${notch('left')}, ${notch('right')}`,
};

/**
 * Alternating bar/space widths for the stub barcode. A fixed literal rather
 * than something generated, so the server and the client render the same bars.
 *
 * Widths stay in the 1–2 range (a 3 only rarely) so the bars read as fine,
 * densely packed modules rather than chunky blocks.
 */
const BARCODE_WIDTHS = [
    2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 3, 1, 1, 1, 2, 2, 1, 1, 1, 1,
    2, 1, 3, 1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1, 2,
    1, 1, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 2, 1,
    2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 1,
];

export function Barcode({ className }: { className?: string }) {
    let x = 0;
    // Even indices are bars, odd indices the gaps between them.
    const bars = BARCODE_WIDTHS.map((w, i) => {
        const bar = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={28} /> : null;
        x += w;
        return bar;
    });

    return (
        <svg
            viewBox={`0 0 ${x} 28`}
            width={x}
            height={28}
            fill="currentColor"
            aria-hidden="true"
            className={className}
        >
            {bars}
        </svg>
    );
}

/**
 * Dashed tear line and the stub below it. Render as the last child of a
 * `relative` card carrying {@link TICKET_SURFACE}, and reserve {@link STUB_H}
 * pixels for it by keeping the card's own padding above the line.
 */
export function TicketStub({ note }: { note: string }) {
    return (
        <>
            <div
                className="absolute inset-x-[18px] border-t border-dashed border-slate-300/80 dark:border-white/15"
                style={{ bottom: STUB_H }}
            />

            <div
                className="flex items-center justify-between gap-4 px-5"
                style={{ height: STUB_H }}
            >
                <span className="font-mono text-[11px] tracking-tight text-slate-500 dark:text-slate-400 truncate">
                    {note}
                </span>
                <Barcode className="h-5 w-auto shrink-0 text-slate-800/85 dark:text-white/70" />
            </div>
        </>
    );
}
