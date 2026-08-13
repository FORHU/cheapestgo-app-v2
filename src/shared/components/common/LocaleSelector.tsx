"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { SELECTOR_TONES, type SelectorVariant } from '@/shared/components/common/selector-tone';
import { FlagIcon, type FlagCode } from '@/shared/components/common/FlagIcon';

/**
 * Menu order and labels follow the design: flag on the left, the two-letter
 * label on the right. The labels are the country the language is shown for
 * (KR, JP, CN), not the ISO language code stored in the cookie — `cn` and `ja`
 * are what `src/i18n/request.ts` reads, so those values stay as they are.
 */
const LOCALES = [
    { code: 'en', label: 'EN', flag: 'US' },
    { code: 'ko', label: 'KR', flag: 'KR' },
    { code: 'ja', label: 'JP', flag: 'JP' },
    { code: 'cn', label: 'CN', flag: 'CN' },
] as const satisfies ReadonlyArray<{ code: string; label: string; flag: FlagCode }>;

type Locale = (typeof LOCALES)[number]['code'];

const LOCALE_COOKIE = 'locale';

function getLocaleCookie(): Locale | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : undefined;
    return LOCALES.some((l) => l.code === value) ? (value as Locale) : undefined;
}

function setLocaleCookie(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LocaleSelector({ variant = 'default' }: { variant?: SelectorVariant } = {}) {
    const tone = SELECTOR_TONES[variant];
    const [mounted, setMounted] = useState(false);
    const [locale, setLocale] = useState<Locale>('en');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        const cookieLocale = getLocaleCookie();
        if (cookieLocale) {
            setLocale(cookieLocale);
        }
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
        setLocale(next);
        setLocaleCookie(next);
        router.refresh();
    };

    if (!mounted) return null;

    const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

    return (
        <div className="relative shrink-0" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={cn("flex items-center gap-1.5 px-1 py-1 text-xs font-medium rounded-lg transition-colors group cursor-pointer", tone.trigger)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label="Select language"
            >
                <FlagIcon code={current.flag} className={tone.flagRing} />
                <span className="hidden sm:inline">{current.label}</span>
                <ChevronDown
                    className={cn(
                        'w-3 h-3 transition-transform',
                        variant === 'onDark' ? 'opacity-60' : 'text-slate-400',
                        open && 'rotate-180'
                    )}
                />
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
                            tone.menu,
                            tone.divider
                        )}
                    >
                        {LOCALES.map((loc) => (
                            <li key={loc.code} role="option" aria-selected={locale === loc.code}>
                                <button
                                    type="button"
                                    onClick={() => handleLocaleSelect(loc.code)}
                                    className={cn(
                                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide transition-colors cursor-pointer",
                                        tone.item(locale === loc.code)
                                    )}
                                >
                                    <FlagIcon code={loc.flag} className={tone.flagRing} />
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
