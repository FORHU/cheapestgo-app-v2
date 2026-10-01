import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { legalSections, type LegalDocument, type Translator } from '../legal-sections';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';

/**
 * The legal documents render from the messages, and every string in them reaches the page.
 *
 * A renderer driven by the data picks up new keys on its own, which is the point — v1 is still
 * editing this copy. The risk that buys is the opposite one: a key shaped in a way the renderer
 * does not recognise disappearing in silence, on the pages that state what someone is agreeing
 * to and who holds their data. So the coverage check below is the real test here, and it is
 * deliberately exhaustive rather than a sample.
 */

const DOCS: LegalDocument[] = ['terms', 'privacy', 'refund', 'cookie'];

type Section  = Record<string, unknown>;
type Document = Record<string, Section>;
type Messages = { legal: { content: Record<string, Document> } };

/** The messages files are read structurally; their generated types are far too specific. */
const messagesOf = (file: unknown) => file as unknown as Messages;
const docOf = (file: unknown, doc: LegalDocument): Document => messagesOf(file).legal.content[doc];

/** A translator over a messages object, matching next-intl's `t` / `t.raw` surface. */
function translator(file: unknown): Translator {
    const read = (key: string) =>
        key.split('.').reduce<unknown>(
            (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
            messagesOf(file).legal,
        );
    const t = ((key: string) => String(read(key) ?? '')) as Translator;
    t.raw = read;
    return t;
}

/**
 * Every leaf string under a node, which is every word that must end up on the page.
 *
 * `linkHref` is excluded: it is a URL that becomes an attribute, not words a reader sees. It is
 * checked separately, as an href, by its own test below.
 */
function leaves(node: unknown): string[] {
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap(leaves);
    if (node && typeof node === 'object') {
        return Object.entries(node)
            .filter(([key]) => key !== 'linkHref')
            .flatMap(([, value]) => leaves(value));
    }
    return [];
}

/** Every `linkHref` under a node, each of which must end up as a real href. */
function hrefs(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(hrefs);
    if (node && typeof node === 'object') {
        return Object.entries(node).flatMap(([key, value]) =>
            key === 'linkHref' && typeof value === 'string' ? [value] : hrefs(value));
    }
    return [];
}

const renderDoc = (file: unknown, doc: LegalDocument) =>
    render(<>{legalSections(translator(file), doc).map((s, i) => <section key={i}>{s.content}</section>)}</>);

describe.each(DOCS)('the %s document', (doc) => {
    it('renders every section the messages define', () => {
        const sections = legalSections(translator(en), doc);

        expect(sections).toHaveLength(Object.keys(docOf(en, doc)).length);
        expect(sections.every((s) => s.title.length > 0)).toBe(true);
    });

    it('puts every string in the messages onto the page', () => {
        const { container } = renderDoc(en, doc);
        const rendered = container.textContent ?? '';
        const titles = Object.values(docOf(en, doc)).map((section) => section.title);

        const missing = leaves(docOf(en, doc))
            // Titles are rendered by the page shell, from `section.title`, not by the body.
            .filter((text) => text !== '' && !titles.includes(text))
            .filter((text) => !rendered.includes(text));

        expect(missing, `unrendered ${doc} strings:\n${missing.join('\n')}`).toEqual([]);
    });

    it('points every link that carries its own href at it', () => {
        const { container } = renderDoc(en, doc);
        const rendered = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));

        for (const href of hrefs(docOf(en, doc))) {
            expect(rendered, `${doc}: no link points at ${href}`).toContain(href);
        }
    });
});

describe('the Korean storefront', () => {
    it('renders the terms in Korean, not English', () => {
        // The whole reason for this work: AirangGo's legal pages were served in English on a
        // Korean-targeted domain.
        const sections = legalSections(translator(ko), 'terms');

        expect(sections[0].title).toMatch(/[가-힣]/);
        expect(sections[0].title).not.toBe(docOf(en, 'terms').acceptance.title);
    });

    it('covers every document in every language the storefront serves', () => {
        for (const file of [en, ko]) {
            for (const doc of DOCS) {
                expect(legalSections(translator(file), doc).length).toBeGreaterThan(0);
            }
        }
    });
});

describe('a section with a link in the middle of a sentence', () => {
    it('keeps the sentence whole rather than splitting it into three', () => {
        const cancellations = docOf(en, 'terms').cancellations;
        const section = legalSections(translator(en), 'terms').find((s) => s.title === cancellations.title)!;

        render(<div>{section.content}</div>);
        const link = screen.getByRole('link', { name: String(cancellations.refundLinkText) });

        expect(link).toHaveAttribute('href', '/refund');
        // Before, link and after are one paragraph, not three.
        expect(link.closest('p')?.textContent).toContain(String(cancellations.textBefore));
    });
});
