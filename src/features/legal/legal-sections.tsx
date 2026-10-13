import React from 'react';

/**
 * The four legal documents, rendered from the `legal.content.*` messages.
 *
 * The pages used to hold this text as hardcoded English JSX. That made them unreadable to a
 * Korean visitor on a Korean domain — and they are the pages that say who holds a reader's
 * data and what they are agreeing to, so English-only there is the worst place for it.
 *
 * Rendered from the data rather than as one block of JSX per section, which v1 does. There are
 * 45 sections across the four documents and v1's copy is still being edited, so a bespoke
 * block per section is both longer and a thing to keep in step by hand. Here a section is
 * whatever its message object says it is, and a new key appears on the page without this file
 * changing. `legal-sections.test.tsx` fails if a key is ever added that this cannot render, so
 * "picks it up automatically" does not quietly become "drops it silently".
 *
 * Field order follows the key order in the messages file, which is the order the document was
 * written in.
 */

/** Where a `*LinkText` field points, by `document.section`. */
const SECTION_LINKS: Record<string, string> = {
    'terms.cancellations': '/refund',
    'privacy.cookies':     '/cookies',
    'cookie.thirdParty':   'https://stripe.com/privacy',
};

const P = 'text-sm leading-relaxed';
const UL = 'list-disc pl-5 space-y-1 text-sm';

export interface LegalSection {
    title:   string;
    content: React.ReactNode;
}

/** A `useTranslations('legal')` or `getTranslations('legal')` result. */
export interface Translator {
    (key: string): string;
    raw: (key: string) => unknown;
}

/** The documents this module knows how to render, in the order their pages list them. */
export type LegalDocument = 'terms' | 'privacy' | 'refund' | 'cookie';

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * A nested block, in any of the shapes the four documents use for one.
 *
 * The lead is `heading` in a cookie category, `label` in a list entry and `title` elsewhere;
 * the prose is `body` or `text`. They are the same thing wearing three names, so they are
 * read as one rather than given three branches. An entry may also carry its own
 * `linkText` + `linkHref`, which is a link belonging to that entry and not to the section.
 */
interface BlockShape {
    heading?: string; label?: string;
    body?:    string; text?:  string;
    items?:   string[];
    linkText?: string; linkHref?: string;
}

function isBlock(v: unknown): v is BlockShape {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function Block({ block }: { block: BlockShape }) {
    const lead = block.heading ?? block.label;
    const body = block.body ?? block.text;

    return (
        <div className="mt-3">
            {lead && <p className="text-sm font-semibold text-slate-900 dark:text-white">{lead}</p>}
            {body && (
                <p className={P}>
                    {body}
                    {block.linkText && (
                        <a href={block.linkHref ?? '#'} className="text-blue-600 dark:text-blue-400 underline">{block.linkText}</a>
                    )}
                </p>
            )}
            {isStringArray(block.items) && (
                <ul className={UL}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
            )}
        </div>
    );
}

/** The address inside a `contact.email` field, which carries a leading emoji. */
function mailtoFrom(contactEmail: string | undefined): string {
    const address = (contactEmail ?? '').match(/[^\s]+@[^\s]+/)?.[0] ?? '';
    return address ? `mailto:${address}` : '#';
}

/**
 * The fields of one section, in their authored order.
 *
 * A `*Before` / `*LinkText` / `*After` trio is one sentence with a link in the middle, so the
 * three are emitted together and the loop skips past them. Splitting them into three
 * paragraphs is what the naming is there to prevent.
 */
function sectionBody(key: string, section: Record<string, unknown>, contactEmail?: string): React.ReactNode[] {
    const entries = Object.entries(section).filter(([field]) => field !== 'title');
    const out: React.ReactNode[] = [];
    /** Fields already emitted as part of a link sentence. */
    const consumed = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
        const [field, value] = entries[i];

        // The link trio: <before> <link> <after>, or <before> <email> <after> when no link
        // text is given — `yourRights` and `howToCancel` put the support address in the gap.
        if (field.endsWith('Before')) {
            const stem = field.slice(0, -'Before'.length);
            // The link text is not always named after the stem: `textBefore` is followed by
            // `refundLinkText` in one document and by a plain `linkText` in another. Any
            // field ending in LinkText counts, and there is at most one per section.
            const linkField = Object.keys(section).find((f) => f.endsWith('LinkText'));
            const linkText  = linkField ? (section[linkField] as string) : undefined;
            const after     = section[`${stem}After`] as string | undefined;
            // With no link text the gap holds the support address, as in "email us at ...".
            const href      = linkText ? SECTION_LINKS[key] : mailtoFrom(contactEmail);

            out.push(
                <p key={field} className={P}>
                    {String(value)}
                    {linkText && (
                        <a href={href} className="text-blue-600 dark:text-blue-400 underline">{linkText}</a>
                    )}
                    {after && ` ${after}`}
                </p>,
            );
            // Skip whichever of the three this consumed, wherever they sit in the order.
            consumed.add(linkField ?? "");
            consumed.add(`${stem}After`);
            continue;
        }
        // Consumed by the branch above.
        if (consumed.has(field)) continue;

        if (isStringArray(value)) {
            out.push(<ul key={field} className={UL}>{value.map((item, n) => <li key={n}>{item}</li>)}</ul>);
            continue;
        }
        if (Array.isArray(value)) {
            out.push(<div key={field}>{value.map((b, n) => <Block key={n} block={b} />)}</div>);
            continue;
        }
        if (isBlock(value)) {
            out.push(<Block key={field} block={value} />);
            continue;
        }
        // A `*Label` introduces the list under it, so it is emphasised rather than body copy.
        out.push(
            <p key={field} className={field.endsWith('Label') ? 'text-sm font-semibold text-slate-900 dark:text-white mt-3' : P}>
                {String(value)}
            </p>,
        );
    }

    return out;
}

/** Every section of one document, ready to render. */
export function legalSections(t: Translator, doc: LegalDocument): LegalSection[] {
    const content = t.raw(`content.${doc}`) as Record<string, Record<string, unknown>>;
    // Every document ends with a contact section. Sections that say "email us" mid-sentence
    // carry no address of their own and borrow that one.
    const contactEmail = content.contact?.email as string | undefined;

    return Object.entries(content).map(([key, section]) => ({
        title:   String(section.title ?? ''),
        content: <>{sectionBody(`${doc}.${key}`, section, contactEmail)}</>,
    }));
}
