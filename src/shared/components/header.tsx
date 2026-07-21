"use client";

import React, { Suspense, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Moon, Sun, Download, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/shared/components/ThemeContext';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { useUserCurrency, useSearchActions } from '@/stores/searchStore';
import { useAuthStore } from '@/shared/auth/store';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { cn } from '@/shared/lib/cn';
import { useTranslations } from 'next-intl';

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

function LocaleSelector() {
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<Locale>('en');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations('nav');

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
        className="flex items-center gap-1 px-1 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors group cursor-pointer"
        aria-label="Select language"
      >
        <span className="text-sm">{LOCALE_FLAGS[locale]}</span>
        <span className="hidden xs:inline">{locale.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 min-w-[110px] py-1 rounded-xl dark:border-white/10 bg-white/20 backdrop-blur dark:bg-slate-900 shadow-lg z-[1001]"
          >
            {LOCALES.map((loc) => (
              <li key={loc}>
                <button
                  type="button"
                  onClick={() => handleLocaleSelect(loc)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer w-full text-left",
                    locale === loc
                      ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <span className="text-[9px] text-slate-400 font-bold w-4">{LOCALE_COUNTRIES[loc]}</span>
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

const HeaderContent = () => {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const userCurrency = useUserCurrency();
  const { setUserCurrency, setUserCountry } = useSearchActions();
  const { user } = useAuthStore();
  const { triggerInstall } = usePWAInstall();
  const t = useTranslations('nav');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCurrencySelect = (currencyCode: string, countryCode: string) => {
    setUserCurrency(currencyCode);
    setUserCountry(countryCode);
    if (pathname.includes('/property/') || pathname.includes('/flights')) {
      const params = new URLSearchParams(window.location.search);
      params.set('currency', currencyCode);
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  const { isInstallable, isIOS, isInstalled } = usePWAInstall();
  const showInstallButton = !isInstalled && (isInstallable || isIOS);

  return (
    <>
      <header suppressHydrationWarning className={cn(
        "sticky top-0 z-60 w-full border-b border-slate-200 dark:border-white/5 bg-white/70 dark:bg-obsidian/70 backdrop-blur-xl transition-colors duration-800 landscape-compact-header",
      )}>
        <div suppressHydrationWarning className="max-w-[1400px] mx-auto px-4 sm:px-6 h-11 md:h-14 flex items-center justify-between landscape-compact-header">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <h1 className="text-base sm:text-lg md:text-xl text-slate-900 dark:text-white font-display font-bold tracking-tight truncate max-w-[120px] sm:max-w-none">
              Cheapest<span className="text-alabaster-accent dark:text-obsidian-accent">Go</span>
            </h1>
          </Link>

          {/* Navigation Items (Visible on all screens) */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Open App Button (Compact on mobile) */}
            {showInstallButton && (
              <button
                onClick={triggerInstall}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-normal text-blue-600 dark:text-blue-400 border border-blue-600/20 dark:border-blue-400/20 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shrink-0"
              >
                <Download size={12} />
                <span className="hidden sm:inline">{t('openApp')}</span>
              </button>
            )}

            {/* Language selector */}
            <LocaleSelector />

            {/* Currency selector */}
            <CurrencySelector className="shrink-0" />

            {/* Trips */}
            <Link href="/trips" className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-normal text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0">
              {t('trips')}
            </Link>

            {/* Support (Hidden on very small mobile) */}
            <a href="mailto:support@cheapestgo.com" className="hidden xs:flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-normal text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0">
              {t('support')}
            </a>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            >
              {mounted && (theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />)}
            </button>

            {/* Sign in Dropdown (Desktop only) */}
            <div className="hidden lg:block shrink-0">
              <SignInDropdown />
            </div>
          </nav>
        </div>
      </header>
    </>
  );
};

const Header = () => (
  <Suspense fallback={null}>
    <HeaderContent />
  </Suspense>
);

export { Header };
export default Header;