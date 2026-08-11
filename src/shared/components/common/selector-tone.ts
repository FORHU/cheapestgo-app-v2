/**
 * Shared look for the small header dropdowns (locale, currency).
 *
 * `default` is the themed app header. `onDark` is for surfaces that are dark
 * whatever the app theme is — currently the landing page — and matches the
 * search bar's note panels: same surface, hairline and shadow.
 */

export type SelectorVariant = 'default' | 'onDark';

interface SelectorTone {
    trigger: string;
    menu: string;
    item: (selected: boolean) => string;
}

export const SELECTOR_TONES: Record<SelectorVariant, SelectorTone> = {
    default: {
        trigger: 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5',
        menu: 'rounded-xl dark:border-white/10 bg-white/20 backdrop-blur dark:bg-slate-900 shadow-lg',
        item: (selected) =>
            selected
                ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5',
    },
    onDark: {
        trigger: 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/[0.07]',
        menu: 'rounded-[20px] border border-white/10 bg-[rgba(26,26,26,0.98)] shadow-[0_26px_55px_-18px_rgba(0,0,0,0.7)]',
        item: (selected) =>
            selected ? 'bg-white/10 text-white' : 'text-[#f1f5f9] hover:bg-white/[0.07]',
    },
};
