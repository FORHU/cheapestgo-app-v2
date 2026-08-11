"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { SELECTOR_TONES, type SelectorVariant } from '@/shared/components/common/selector-tone';

const LOCALE_COUNTRIES: Record<string, string> = {
  en: 'US',
  ko: 'KR',
  cn: 'CN',
  ja: 'JP',
};

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  ko: '🇰🇷',
  cn: '🇨🇳',
  ja: '🇯🇵',
};

const LOCALE_NAMES: Record<string, string> = {
  en: 'EN',
  ko: '한국어',
  cn: '中文',
  ja: '日本語',
};

const LOCALES = ['en', 'ko', 'cn', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALE_COOKIE = 'locale';

function getLocaleCookie(): Locale | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return (LOCALES as readonly string[]).includes(value ?? '') ? (value as Locale) : undefined;
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
    if (next === locale) return;
    setLocale(next);
    setLocaleCookie(next);
    setOpen(false);
    router.refresh();
  };

  if (!mounted) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn("flex items-center gap-1 px-1 py-1 text-xs font-medium rounded-lg transition-colors group cursor-pointer", tone.trigger)}
        aria-label="Select language"
      >
        <span className="text-sm">{LOCALE_FLAGS[locale]}</span>
        <span className="hidden xs:inline">{locale.toUpperCase()}</span>
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
            className={cn("absolute right-0 top-full mt-1 min-w-[110px] py-1 z-[1001]", tone.menu)}
          >
            {LOCALES.map((loc) => (
              <li key={loc}>
                <button
                  type="button"
                  onClick={() => handleLocaleSelect(loc)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer w-full text-left",
                    tone.item(locale === loc)
                  )}
                >
                  <span className={cn("text-[9px] font-bold w-4", variant === 'onDark' ? 'opacity-60' : 'text-slate-400')}>{LOCALE_COUNTRIES[loc]}</span>
                  <span>{LOCALE_NAMES[loc]}</span>
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
