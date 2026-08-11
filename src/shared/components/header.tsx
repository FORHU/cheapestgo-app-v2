"use client";

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Moon, Sun, Download } from 'lucide-react';
import { useTheme } from '@/shared/components/ThemeContext';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { useUserCurrency, useSearchActions } from '@/stores/searchStore';
import { useAuthStore } from '@/shared/auth/store';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
import { cn } from '@/shared/lib/cn';
import { useTranslations } from 'next-intl';

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

          {/* Navigation Items*/}
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Open App */}
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

            {/* Support */}
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

            {/* Sign in */}
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