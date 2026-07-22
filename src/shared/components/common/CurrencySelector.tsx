"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency, useUserCountry, useSearchActions } from '@/stores/searchStore';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export const CURRENCIES = [
  { code: 'KRW', country: 'KR', flag: '🇰🇷' },
  { code: 'USD', country: 'US', flag: '🇺🇸' },
  { code: 'PHP', country: 'PH', flag: '🇵🇭' },
] as const;

interface CurrencySelectorProps {
  className?: string;
  align?: 'left' | 'right';
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ 
  className, 
  align = 'right' 
}) => {
  const userCurrency = useUserCurrency();
  const userCountry = useUserCountry();
  const { setUserCurrency, setUserCountry } = useSearchActions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleCurrencySelect = (currencyCode: string, countryCode: string) => {
    setUserCurrency(currencyCode);
    setUserCountry(countryCode);
    setIsOpen(false);

    if (pathname && (pathname.includes('/property/') || pathname.includes('/flights'))) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('currency', currencyCode);
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  const currentCurrency = CURRENCIES.find(c => c.code === userCurrency) || CURRENCIES[0];

  return (
    <div className={cn("relative shrink-0", className)} ref={ref}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-1 px-1 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-white/5 dark:hover:bg-white/5 rounded-lg transition-colors group cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select currency"
      >
        <span className="text-sm">{currentCurrency.flag}</span>
        <span className="hidden xs:inline">{userCurrency}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className={cn(
              "absolute top-full mt-1 min-w-[120px] py-1 rounded-lg dark:border-white/10 bg-white/20 backdrop-blur dark:bg-slate-900 shadow-lg z-50 cursor-pointer",
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            {CURRENCIES.map((currency) => (
              <li key={currency.code} role="option" aria-selected={userCurrency === currency.code}>
                <button
                  type="button"
                  onClick={() => handleCurrencySelect(currency.code, currency.country)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-normal transition-colors",
                    userCurrency === currency.code
                      ? 'dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <span className="text-sm">{currency.flag}</span>
                  {currency.code}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CurrencySelector;