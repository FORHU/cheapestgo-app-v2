/**
 * Restate the copy in the brand actually being served.
 *
 * The translations were written for CheapestGo and name it outright — the sign-in
 * prompt, the footer, the FAQ, and the privacy and cookie policies, which say which
 * site is collecting the reader's data. Served unchanged from GeomeeGo's domain those
 * sentences are simply wrong, and the policy ones name the wrong site as the one doing
 * the collecting. GeomeeGo is the same product under a different brand ([ADR-0005]),
 * not a separate one, so the copy has to follow the brand env vars like everything else.
 *
 * Applied once to the merged messages, so every locale is covered and no caller has to
 * pass the brand in. next-intl v4 removed `defaultTranslationValues`, which is the
 * mechanism this would otherwise use.
 *
 * The match is case-sensitive on purpose. The brand appears lowercase only inside
 * addresses — `support@cheapestgo.com`, `www.cheapestgo.com` — and those are real
 * mailboxes and hosts, not prose: rewriting them invents an address that may not exist.
 * Contact details are configuration and belong in their own setting.
 */
export function applyBrand<T>(messages: T): T {
    const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'CheapestGo';
    if (brand === 'CheapestGo') return messages;

    const rewrite = (node: unknown): unknown => {
        if (typeof node === 'string') return node.split('CheapestGo').join(brand);
        if (Array.isArray(node)) return node.map(rewrite);
        if (node && typeof node === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = rewrite(v);
            return out;
        }
        return node;
    };

    return rewrite(messages) as T;
}
