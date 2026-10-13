'use client';

import { BRAND_PREVIEW_PARAM } from '@/shared/lib/brand';

/**
 * The two brands a preview deployment can show, as a control on the page.
 *
 * Rendered only where the brand preview is on — the root layout decides, so on production this
 * never reaches the page at all. Choosing one navigates to the current address with
 * `?brand_preview=…`; the middleware stores the pick and returns the visitor to the same page.
 * A plain navigation rather than client state, because the brand is read on the server and the
 * whole page has to be rendered again to change.
 */
const CHOICES = [
    { slug: 'cheapestgo', label: 'CheapestGo' },
    { slug: 'airanggo',   label: 'AirangGo' },
] as const;

export function BrandPreviewSwitcher({ current }: { current: string }) {
    const choose = (slug: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set(BRAND_PREVIEW_PARAM, slug);
        window.location.assign(url.toString());
    };

    return (
        <nav
            aria-label="Preview brand"
            // Above the mobile bottom nav's 80px bar and its safe-area inset; on a desktop it sits
            // in the corner. Low-contrast chrome on purpose — it is a tool for the people building
            // this, not part of the design.
            className="fixed left-3 bottom-[calc(env(safe-area-inset-bottom,0px)+92px)] z-[70] flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/90 p-1 text-[11px] font-medium text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-200 lg:bottom-3"
        >
            <span className="px-2 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</span>
            {CHOICES.map(({ slug, label }) => {
                const active = label === current;
                return (
                    <button
                        key={slug}
                        type="button"
                        aria-pressed={active}
                        onClick={() => { if (!active) choose(slug); }}
                        className={
                            active
                                ? 'rounded-full bg-blue-600 px-2.5 py-1 text-white'
                                : 'rounded-full px-2.5 py-1 hover:bg-slate-200/70 dark:hover:bg-white/10'
                        }
                    >
                        {label}
                    </button>
                );
            })}
        </nav>
    );
}
