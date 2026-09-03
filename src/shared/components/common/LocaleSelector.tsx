"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { SELECTOR_TONES, type SelectorChrome, type SelectorVariant } from '@/shared/components/common/selector-tone';
import { FlagIcon, type FlagCode } from '@/shared/components/common/FlagIcon';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Menu order and labels follow the design: flag on the left, the two-letter
 * label on the right. The labels name the country the language is shown for
 * (KR, JP, CN); `code` is the BCP-47 language subtag, which is what the URL and
 * `src/i18n/request.ts` use — Chinese is `zh`, not the country code `cn`.
 */
const LOCALES = [
    { code: 'en', label: 'EN', flag: 'US' },
    { code: 'ko', label: 'KR', flag: 'KR' },
    { code: 'ja', label: 'JP', flag: 'JP' },
    { code: 'zh', label: 'CN', flag: 'CN' },
] as const satisfies ReadonlyArray<{ code: Locale; label: string; flag: FlagCode }>;

export function LocaleSelector({ variant = 'default', chrome, iconOnly = false }: {
    variant?: SelectorVariant;
    /**
     * Draw from these colours instead of `variant`'s classes. See
     * `SelectorChrome` — it is for chrome that is not the app theme, which no
     * `dark:` variant can follow.
     */
    chrome?: SelectorChrome;
    /**
     * Collapse the trigger to a circle carrying the active flag alone — no
     * label, no chevron. See the same prop on CurrencySelector: the flag is
     * already the icon, so nothing is lost by dropping the two letters beside
     * it.
     */
    iconOnly?: boolean;
} = {}) {
    const tone = SELECTOR_TONES[variant];
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    /** Row hover in state — see the same note in CurrencySelector. */
    const [hovered, setHovered] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    // The URL is the source of truth for language (ADR-0015), so the current
    // locale is read from the route rather than from a cookie this component
    // owns. `pathname` here is already locale-stripped, which is what lets the
    // same path be re-rendered under a different prefix below.
    const locale = useLocale() as Locale;
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleLocaleSelect = (next: Locale) => {
        setOpen(false);
        if (next === locale) return;
        // Re-render the page the visitor is on under the new prefix, so the
        // language is in the address bar and survives being shared. `replace`
        // rather than `push`: switching language is not a place in history.
        router.replace(pathname, { locale: next });
    };

    if (!mounted) return null;

    const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

    return (
        <div className="relative shrink-0" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "flex items-center text-xs font-medium transition-colors group cursor-pointer",
                    chrome
                        // On chrome the trigger is a control on a toolbar, so it takes
                        // the toolbar's own geometry — the icon circle its neighbours
                        // are drawn at, or a pill when it still carries a label.
                        ? iconOnly
                            ? "h-6 w-6 shrink-0 justify-center rounded-full hover:opacity-80 md:h-10 md:w-10"
                            : "h-6 gap-1.5 rounded-full px-2 hover:opacity-80 md:h-10 md:px-3"
                        : cn("gap-1.5 px-1 py-1 rounded-lg", tone.trigger),
                )}
                style={chrome ? { background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text } : undefined}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={iconOnly ? `Language: ${current.label}` : 'Select language'}
            >
                {/* Inside a 24px circle the flag has to come down off its 22px
                    header size or it runs to the button's own edge. */}
                <FlagIcon
                    code={current.flag}
                    className={cn(iconOnly && 'h-[12px] w-[17px] md:h-[13px] md:w-[19px]', !chrome && tone.flagRing)}
                />
                {!iconOnly && (
                    <>
                        <span className="hidden sm:inline">{current.label}</span>
                        <ChevronDown
                            className={cn(
                                'w-3 h-3 transition-transform',
                                chrome ? 'opacity-60' : variant === 'onDark' ? 'opacity-60' : 'text-slate-400',
                                open && 'rotate-180'
                            )}
                        />
                    </>
                )}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.ul
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        role="listbox"
                        aria-label="Language"
                        className={cn(
                            "absolute right-0 top-full mt-1.5 min-w-[124px] overflow-hidden z-[1001]",
                            chrome ? "rounded-2xl" : cn(tone.menu, tone.divider)
                        )}
                        style={chrome ? { background: chrome.menu, border: `1px solid ${chrome.border}`, boxShadow: chrome.shadow } : undefined}
                    >
                        {LOCALES.map((loc) => (
                            <li key={loc.code} role="option" aria-selected={locale === loc.code}>
                                <button
                                    type="button"
                                    onClick={() => handleLocaleSelect(loc.code)}
                                    onMouseEnter={chrome ? () => setHovered(loc.code) : undefined}
                                    onMouseLeave={chrome ? () => setHovered(null) : undefined}
                                    className={cn(
                                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide transition-colors cursor-pointer",
                                        !chrome && tone.item(locale === loc.code)
                                    )}
                                    style={chrome ? {
                                        background: locale === loc.code || hovered === loc.code ? chrome.hover : 'transparent',
                                        color: chrome.text,
                                    } : undefined}
                                >
                                    <FlagIcon code={loc.flag} className={chrome ? undefined : tone.flagRing} />
                                    <span>{loc.label}</span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

export default LocaleSelector;
