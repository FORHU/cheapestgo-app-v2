'use client';

/**
 * Save what the print button prints, as a PDF file, without the print dialog.
 *
 * The page's own DOM is drawn to a canvas and laid onto A4 pages, so the file carries the same
 * sections, numbers and layout as the printed copy rather than a second rendering that can drift
 * from it. Two things keep it the printed copy and not a screenshot:
 *
 *   - it is laid out at A4 width (`PRINT_WIDTH`), so a phone gets the same document a desktop
 *     printer would, not a narrow strip stretched across the page;
 *   - whatever print hides (`.no-print`, Tailwind's `print:hidden`) is left out, the page is drawn
 *     in light mode, and the print-only overrides apply — see `PRINT_LIKE` and the
 *     `html[data-pdf]` rules beside each `@media print` block.
 *
 * Both libraries load on the first click: neither belongs in the bundle of a page most people only
 * read.
 */

import { useCallback, useState } from 'react';

/** An A4 page at 96 dpi, which is the width the browser lays a printed page out at. */
const PRINT_WIDTH = 794;

/** What print hides, the file hides. */
const SKIP = '.no-print, .print\\:hidden, [data-pdf-ignore]';

/** Tailwind's `print:` variants, which only match in print media, restated for the capture. */
const PRINT_LIKE = `
    .print\\:shadow-none { box-shadow: none !important; }
    .print\\:rounded-none { border-radius: 0 !important; }
    .print\\:bg-white { background: #fff !important; }
    .print\\:p-0 { padding: 0 !important; }
`;

/** `Receipt_GG-AB12CD.pdf` — the reference a traveller would search their files for. */
export function pdfFilename(prefix: string, reference: string | null | undefined): string {
    const safe = (reference ?? '').replace(/[^A-Za-z0-9_-]+/g, '');
    return `${prefix}_${safe || 'booking'}.pdf`;
}

export async function saveElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: PRINT_WIDTH,
        ignoreElements: (node) => node instanceof Element && node.matches(SKIP),
        onclone: (doc, clone) => {
            doc.documentElement.classList.remove('dark');
            doc.documentElement.style.colorScheme = 'light';
            doc.documentElement.setAttribute('data-pdf', '');
            const style = doc.createElement('style');
            style.textContent = PRINT_LIKE;
            doc.head.appendChild(style);
            // A full-screen page is `min-height: 100vh`; on paper that is a blank page at the end.
            clone.style.minHeight = '0';
        },
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const margin = 10;
    const width  = pdf.internal.pageSize.getWidth()  - margin * 2;
    const height = pdf.internal.pageSize.getHeight() - margin * 2;
    const pxPerMm = canvas.width / width;
    const pagePx  = Math.floor(height * pxPerMm);

    // One tall canvas, cut into page-high slices: a receipt is usually one page, an itinerary
    // with several flights can run to two.
    for (let top = 0, page = 0; top < canvas.height; top += pagePx, page++) {
        const sliceHeight = Math.min(pagePx, canvas.height - top);
        const slice = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = sliceHeight;
        const ctx = slice.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, top, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, width, sliceHeight / pxPerMm);
    }

    pdf.save(filename);
}

/**
 * The download button's state. A failure is a note beside the button, not an alert: printing
 * still works, and saying so is more use than a dialog.
 */
export function useSavePdf() {
    const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

    const save = useCallback(async (element: HTMLElement | null, filename: string) => {
        if (!element) return;
        setState('busy');
        try {
            await saveElementAsPdf(element, filename);
            setState('idle');
        } catch (err) {
            console.error('Receipt PDF failed', err);
            setState('failed');
        }
    }, []);

    return { save, busy: state === 'busy', failed: state === 'failed' };
}
