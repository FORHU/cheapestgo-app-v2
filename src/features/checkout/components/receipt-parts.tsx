'use client';

/**
 * The pieces both booking receipts are built from — the flight's (`flight-confirmed-screen.tsx`)
 * and the hotel's (`hotel-confirmed-screen.tsx`) — so the two confirmations read as one design
 * and cannot drift apart: the finished step bar, a fact as a caption over its value, a reference
 * in the form's box with its own Copy, and the print rules.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Copy, CopyCheck, Download, Loader2, Printer } from 'lucide-react';
import type { Palette } from '@/features/checkout/lib/palette';
import { BRAND } from '@/shared/lib/palette';
import { pdfFilename, useSavePdf } from '@/shared/lib/receipt-pdf';

/** Prices, times and references: tabular figures, so they line up and read as data. */
export const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
/** The form's field corners (`FIELD_RADIUS` on the checkout page), so a box shown here reads as
 *  one of the form's. */
const FIELD_RADIUS = 14;

/** The box a field is drawn in on the form, without the input: the same height, fill, hairline
 *  and corners, but no hover or focus ring, since there is nothing here to type into. */
export function fieldBox(palette: Palette): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', minWidth: 0, height: 'var(--cg-field-h)', padding: '0 16px',
        borderRadius: FIELD_RADIUS, border: `1px solid ${palette.fieldLine}`, background: palette.fieldBg,
        color: palette.text, fontSize: 'var(--cg-field-fs)', boxSizing: 'border-box',
    };
}

export const ellipsis: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** One fact about the booking: a quiet caption over its value. A `dt`/`dd` pair, so it reads as
 *  a label and its value. */
export function Fact({ label, children, palette }: { label: string; children: React.ReactNode; palette: Palette }) {
    return (
        <div style={{ minWidth: 0 }}>
            <dt style={{ fontSize: 'var(--cg-label-fs)', color: palette.muted }}>{label}</dt>
            <dd style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: palette.title, overflowWrap: 'anywhere' }}>{children}</dd>
        </div>
    );
}

/**
 * The checkout's three steps, every one of them done. The form's bar marks only the step in hand;
 * once the booking is confirmed there is no step in hand, and the bar says instead that all three
 * are behind the traveller: each disc filled and ticked, the hairlines between them in the same
 * blue. Same geometry as the form's (32px discs, its `--step-gap` connectors, 12px captions), so
 * the bar does not jump when the confirmation replaces the payment step.
 */
const STEP_KEYS = ['steps.details', 'steps.payment', 'steps.verification'] as const;

export function DoneSteps({ palette }: { palette: Palette }) {
    const t = useTranslations('checkout');
    return (
        <ol style={{ display: 'flex', alignItems: 'flex-start', listStyle: 'none', margin: 0, padding: 0 }}>
            {STEP_KEYS.map((key, i) => (
                <li key={key} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 32, flexShrink: 0 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: BRAND.primaryStrong, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Check aria-hidden size={16} strokeWidth={2.5} />
                        </div>
                        <div style={{ fontSize: 12, color: palette.text, whiteSpace: 'nowrap' }}>{t(key)}</div>
                    </div>
                    {i < STEP_KEYS.length - 1 && (
                        <div aria-hidden style={{ width: 'clamp(40px,6vw,90px)', height: 1, marginTop: 16, background: BRAND.primaryStrong }} />
                    )}
                </li>
            ))}
        </ol>
    );
}

/**
 * Copy-to-clipboard with a short "Copied" state, for whichever reference was copied last (a
 * receipt can carry two: ours and the airline's).
 */
export function useCopy<T extends string>() {
    const tAll = useTranslations();
    const [copied, setCopied] = useState<T | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const copy = async (value: string, target: T) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(target);
            toast.success(tAll('checkout.flight.receipt.copyReferenceDone'));
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(null), 2000);
        } catch {
            // Clipboard access denied or unavailable — the reference is still on screen to
            // select by hand (a click selects all of it), so this fails quietly rather than with
            // an error the traveller can do nothing about.
        }
    };
    return { copied, copy };
}

/** A reference in the form's box, picked whole by one click, with its own Copy. The button is
 *  named "Copy" and described by the caption above (`captionId`), so the two read apart. */
export function ReferenceBox({ value, copied, onCopy, captionId, palette, valueStyle }: {
    value: string;
    copied: boolean;
    onCopy: () => void;
    captionId: string;
    palette: Palette;
    valueStyle?: React.CSSProperties;
}) {
    const tAll = useTranslations();
    return (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div title={value} style={{ ...fieldBox(palette), flex: 1, fontFamily: MONO, color: palette.title, userSelect: 'all', ...valueStyle }}>
                <span style={ellipsis}>{value}</span>
            </div>
            <button
                type="button"
                onClick={onCopy}
                aria-describedby={captionId}
                className="no-print"
                style={{ ...fieldBox(palette), flexShrink: 0, gap: 8, color: palette.title, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
                {copied ? <CopyCheck aria-hidden size={15} /> : <Copy aria-hidden size={15} />}
                {copied ? tAll('checkout.flight.receipt.copyReferenceDone') : tAll('checkout.flight.receipt.copyReference')}
            </button>
        </div>
    );
}

/** The print rules both receipts share: chrome hidden, ink on white. Wrap the screen in
 *  `.cg-receipt` and mark the summary `.receipt-card`. */
export function ReceiptPrintStyles() {
    return (
        <style>{`
            @media print {
                .no-print { display: none !important; }
                body { background: #fff !important; }
                .cg-receipt, .cg-receipt * { color: #000 !important; box-shadow: none !important; }
                .cg-receipt { background: #fff !important; }
                .receipt-card { background: #fff !important; border: 1px solid #ddd !important; }
            }
            /* The downloaded PDF is the printed copy, so it takes the same overrides. */
            html[data-pdf] .cg-receipt, html[data-pdf] .cg-receipt * { color: #000 !important; box-shadow: none !important; }
            html[data-pdf] .cg-receipt { background: #fff !important; }
            html[data-pdf] .receipt-card { background: #fff !important; border: 1px solid #ddd !important; }
        `}</style>
    );
}

/** A quiet action beside the main one: text, but a 44px target. */
export const textBtn = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px', border: 'none',
    background: 'transparent', color, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
});

/**
 * Download and Print, side by side. Download saves the printed copy as a PDF without opening the
 * print dialog (`receipt-pdf.ts`); Print is still there for anyone who wants paper.
 *
 * `receipt` is the element print would print — the screen's root — and `reference` names the file.
 */
export function ReceiptActions({ palette, receipt, reference }: {
    palette:   Palette;
    receipt:   React.RefObject<HTMLElement | null>;
    reference: string | null;
}) {
    const tAll = useTranslations();
    const { save, busy, failed } = useSavePdf();

    return (
        <>
            <button
                type="button"
                onClick={() => save(receipt.current, pdfFilename('Receipt', reference))}
                disabled={busy}
                aria-busy={busy}
                style={{ ...textBtn(palette.title), cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
            >
                {busy ? <Loader2 aria-hidden size={15} className="animate-spin" /> : <Download aria-hidden size={15} />}
                {busy ? tAll('trips.invoice.generating') : tAll('checkout.success.downloadReceipt')}
            </button>
            <button type="button" onClick={() => window.print()} style={textBtn(palette.title)}>
                <Printer aria-hidden size={15} /> {tAll('checkout.success.printReceipt')}
            </button>
            {failed && (
                <p role="status" style={{ flexBasis: '100%', textAlign: 'center', fontSize: 13, color: palette.muted, margin: 0 }}>
                    {tAll('trips.invoice.pdfError')}
                </p>
            )}
        </>
    );
}
