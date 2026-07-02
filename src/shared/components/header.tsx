"use client";

import React, { Suspense, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Moon, Sun, Download, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/shared/components/ThemeContext';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { useUserCurrency, useSearchActions } from '@/stores/searchStore';
import { usePWAInstall } from '@/contexts/PWAInstallContext';

const CURRENCY_FLAGS: Record<string, string> = {
  PHP: '🇵🇭',
  USD: '🇺🇸',
  KRW: '🇰🇷',
};

const CURRENCIES = ['KRW', 'USD', 'PHP'] as const;

const LOCALES = [
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ko', label: 'KO', flag: '🇰🇷' },
  { code: 'ja', label: 'JA', flag: '🇯🇵' },
  { code: 'cn', label: 'CN', flag: '🇨🇳' },
] as const;

function LocaleSelector() {
  const [open, setOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
    if (match) setCurrentLocale(match[1]);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const switchLocale = (code: string) => {
    document.cookie = `locale=${code}; path=/; max-age=31536000; SameSite=Lax`;
    setCurrentLocale(code);
    setOpen(false);
    window.location.reload();
  };

  const current = LOCALES.find(l => l.code === currentLocale) ?? LOCALES[0];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-1 text-[10px] sm:text-xs font-normal text-blue-600 dark:text-slate-300 hover:bg-white/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
        aria-label="Select language"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden xs:inline">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 min-w-[120px] py-1 rounded-lg dark:border-white/10 bg-white/20 backdrop-blur dark:bg-slate-900 shadow-lg z-50"
          >
            {LOCALES.map(locale => (
              <li key={locale.code}>
                <button
                  type="button"
                  onClick={() => switchLocale(locale.code)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-normal transition-colors ${
                    currentLocale === locale.code
                      ? 'dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm">{locale.flag}</span>
                  {locale.label}
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
  const searchParams = useSearchParams();
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);

  const userCurrency = useUserCurrency();
  const { setUserCurrency } = useSearchActions();
  const { isInstallable, isIOS, isInstalled, triggerInstall } = usePWAInstall();
  const showInstallButton = !isInstalled && (isInstallable || isIOS);

  const currencyFlag = CURRENCY_FLAGS[userCurrency] || '🌐';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setIsCurrencyOpen(false);
      }
    };
    if (isCurrencyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCurrencyOpen]);

  const handleCurrencySelect = (currency: string) => {
    setUserCurrency(currency);
    setIsCurrencyOpen(false);
    if (pathname.includes('/property/') || pathname.includes('/search')) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('currency', currency);
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <header className="fixed top-0 z-50 w-full px-4 pt-1.5 bg-transparent landscape-compact-header font-nunito">
      <div className="w-full sm:w-[95%] mx-auto p-1 px-4 sm:px-6 h-11 md:h-16 flex items-center justify-between bg-slate/20 backdrop-blur rounded-full">

        {/* Logo */}
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity shrink-0">
          <Image
            src="/Web_Logo_Transparent.png"
            alt="CheapestGo"
            width={140}
            height={36}
            className="h-7 md:h-9 w-auto object-contain dark:brightness-[1.15]"
            priority
          />
        </Link>

        {/* Navigation Items */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* NavLinks */}
          <div className="hidden xs:flex items-center gap-2">
            <a
              href="mailto:support@cheapestgo.com"
              className="flex items-center gap-1.5 px-3 py-2 text-[10px] sm:text-xs text-blue-600 dark:text-white hover:bg-white/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              Support
            </a>
          </div>

          {/* Install / Open App Button */}
          {showInstallButton && (
            <button
              onClick={triggerInstall}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-normal text-blue-600 dark:text-blue-400 border border-blue-600/20 dark:border-blue-400/20 rounded-full hover:bg-white/5 dark:hover:bg-blue-500/10 transition-colors shrink-0"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Open app</span>
            </button>
          )}

          {/* Language selector */}
          <LocaleSelector />

          {/* Currency dropdown */}
          <div className="relative shrink-0" ref={currencyRef}>
            <button
              onClick={() => setIsCurrencyOpen((o) => !o)}
              className="flex items-center gap-1 px-1.5 py-1 text-[10px] sm:text-xs font-normal text-blue-600 dark:text-slate-300 hover:bg-white/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              aria-expanded={isCurrencyOpen}
              aria-haspopup="listbox"
              aria-label="Select currency"
            >
              <span className="text-sm">{currencyFlag}</span>
              <span className="hidden xs:inline">{userCurrency}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isCurrencyOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isCurrencyOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  role="listbox"
                  className="absolute right-0 top-full mt-1 min-w-[120px] py-1 rounded-lg dark:border-white/10 bg-white/20 backdrop-blur dark:bg-slate-900 shadow-lg z-50 cursor-pointer"
                >
                  {CURRENCIES.map((currency) => (
                    <li key={currency} role="option" aria-selected={userCurrency === currency}>
                      <button
                        type="button"
                        onClick={() => handleCurrencySelect(currency)}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-normal transition-colors ${
                          userCurrency === currency
                            ? 'dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="text-sm">{CURRENCY_FLAGS[currency]}</span>
                        {currency}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-white/5 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            {theme === 'dark'
              ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
            }
          </button>

          {/* Sign in Dropdown (Desktop only) */}
          <div className="hidden lg:block shrink-0">
            <SignInDropdown />
          </div>
        </nav>
      </div>
    </header>
  );
};

export function Header() {
  return (
    <Suspense fallback={null}>
      <HeaderContent />
    </Suspense>
  );
}
