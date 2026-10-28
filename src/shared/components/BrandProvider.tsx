'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { brandProfile, brandWordmark, canonicalBrandName } from '@/shared/lib/brand';

/**
 * The brand being shown, for client components.
 *
 * `NEXT_PUBLIC_BRAND_NAME` is compiled into the bundle, so it can only say what the build was
 * made for. A deployment with the brand preview on can show the other brand, and the browser has
 * no way to know that except from the server — the root layout resolves it per request and
 * provides it here.
 */
const BrandContext = createContext<string | null>(null);

export function BrandProvider({ name, children }: { name: string; children: ReactNode }) {
    return <BrandContext.Provider value={name}>{children}</BrandContext.Provider>;
}

/**
 * The brand's current name.
 *
 * Outside a provider — a unit test, a tree rendered on its own — it is the build's brand, read
 * when called rather than at import so a test that sets the env var after loading sees it.
 */
export function useBrandName(): string {
    const provided = useContext(BrandContext);
    return provided ?? canonicalBrandName(process.env.NEXT_PUBLIC_BRAND_NAME);
}

/** The wordmark split into the plain part and the accented "Go". */
export function useBrandWordmark(): { head: string; tail: string } {
    const name = useBrandName();
    return useMemo(() => brandWordmark(name), [name]);
}

/** The brand's tab icon and logos, for an `<img>` rather than metadata. */
export function useBrandProfile() {
    const name = useBrandName();
    return useMemo(() => brandProfile(name), [name]);
}
