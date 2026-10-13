/**
 * Tidying a supplier's hotel description for display.
 *
 * The text arrives raw and is stored raw — nothing between the supplier and the
 * page edits it — and RateHawk/ETG in particular flattens its structured fields
 * into the same blob as the prose. So a description routinely ends with a run
 * of facts nobody reading a hotel page is looking for:
 *
 *     …not be available in all the rooms.,No-show availability: unspecified.
 *     No-show day period: unspecified. No-show time: ,Visa support: No
 *     information on the Visa support, Number of rooms: 20., Frequency: 60.,
 *     Voltage: 220., Sockets: Type c. Type f.
 *
 * and carries `.,` where the supplier's own sections were joined.
 *
 * This trims both. It is deliberately mechanical: it splits seams the supplier
 * left behind and drops sections it can *name*, and it never rewrites prose. A
 * description that says "This hostel is located In 4 km from the city center"
 * still says that afterwards — the capital is the supplier's mistake, and
 * guessing at it would risk mangling copy that was fine.
 */

/**
 * The labels ETG flattens its structured fields under.
 *
 * Matched at the start of a section, or at a sentence boundary inside one, so
 * a hotel that genuinely mentions its voltage in prose is not cut off at the
 * knees — the tail always arrives as its own labelled run.
 */
const FACT_LABELS = [
    'No-show availability',
    'No-show day period',
    'No-show time',
    'Visa support',
    'Number of rooms',
    'Frequency',
    'Voltage',
    'Sockets',
    'Check-in time',
    'Check-out time',
    'Deposit',
    'Minimum age',
    'Payment method',
];

/** `Voltage:` and friends, anchored to the start of what it is scanning. */
const FACT_HEAD = new RegExp(`^(?:${FACT_LABELS.join('|')})\\s*:`, 'i');

/**
 * The same labels, but found anywhere a new sentence could begin — used to cut
 * a section that runs from prose straight into facts with no seam between them.
 */
const FACT_ANYWHERE = new RegExp(`(?:^|(?<=[.!?»)])\\s*,?\\s*)(?:${FACT_LABELS.join('|')})\\s*:`, 'i');

/**
 * Split the blob back into the sections the supplier joined.
 *
 * `.,` is the seam: a full stop welded to the comma that joined the next
 * section, with no space. A bare `\n\n` is honoured too, for suppliers that
 * paragraph properly.
 */
function toSections(raw: string): string[] {
    return raw
        .replace(/\r\n/g, '\n')
        // The seam, and only the seam: a comma *directly* after terminal
        // punctuation. A comma with a space before it is ordinary prose.
        .replace(/([.!?»)])\s*,\s*(?=\S)/g, '$1\n\n')
        .split(/\n{2,}/);
}

/**
 * Squeeze the whitespace a flattened blob leaves behind, and drop the
 * supplier's own quotation marks.
 *
 * Runs *after* the sections have been split, never before: the seam pattern
 * counts `»` as terminal punctuation, so a property name in guillemets is one
 * of the anchors that tells two welded sections apart. Strip them first and
 * that seam stops being visible.
 */
function tidy(section: string): string {
    return section
        // Guillemets — the quotation marks Russian typography uses, which this
        // supplier wraps the property name in. Dropped rather than swapped for
        // English quotes: "Seven Hostel is located in Seoul" is simply how the
        // sentence reads here, and quoting the name at all is a convention of
        // the source language rather than anything the sentence needs.
        //
        // Only the angle pairs. Curly doubles are ordinary English punctuation
        // and a description is allowed to quote something.
        .replace(/[«»‹›]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s*\n\s*/g, ' ')
        .trim();
}

/**
 * The description as it should be read: the prose, in paragraphs, with the
 * supplier's facts block removed.
 *
 * Falls back to the original whenever tidying would leave nothing — a
 * description made entirely of facts is still more use than a blank space, and
 * a supplier this has never seen should never end up showing less than it sent.
 */
export function cleanSupplierDescription(raw?: string | null): string {
    const text = raw?.trim();
    if (!text) return '';

    const kept: string[] = [];
    for (const section of toSections(text)) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        // A section that opens with a label is the facts block; everything from
        // here on is that block, so stop rather than skip — the labels run to
        // the end of the description once they start.
        if (FACT_HEAD.test(trimmed)) break;

        // Otherwise the facts may start partway through this one.
        const cut = FACT_ANYWHERE.exec(trimmed);
        if (cut) {
            const head = tidy(trimmed.slice(0, cut.index));
            if (head) kept.push(head);
            break;
        }

        const tidied = tidy(trimmed);
        if (tidied) kept.push(tidied);
    }

    const cleaned = kept.join('\n\n').trim();
    return cleaned || tidy(text);
}
