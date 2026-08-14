"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency, useSearchActions } from '@/shared/stores/search.store';
import { SELECTOR_TONES, type SelectorVariant } from '@/shared/components/common/selector-tone';
import { getCurrencySymbol } from '@/shared/lib/currency';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/** Menu order follows the design: code on the left, symbol on the right. */
export const CURRENCIES = [
  { code: 'USD', country: 'US', symbol: '$' },
  { code: 'KRW', country: 'KR', symbol: '₩' },
  { code: 'PHP', country: 'PH', symbol: '₱' },
  { code: 'JPY', country: 'JP', symbol: '¥' },
  { code: 'CNY', country: 'CN', symbol: '¥' },
] as const;

interface CurrencySelectorProps {
  className?: string;
  align?: 'left' | 'right';
  variant?: SelectorVariant;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  className,
  align = 'right',
  variant = 'default'
}) => {
  const tone = SELECTOR_TONES[variant];
  const userCurrency = useUserCurrency();
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

  // Account preferences can set a currency this menu does not list, so fall
  // back to showing that code rather than mislabelling the trigger.
  const currentSymbol =
    CURRENCIES.find(c => c.code === userCurrency)?.symbol ?? getCurrencySymbol(userCurrency);

  return (
    <div className={cn("relative shrink-0", className)} ref={ref}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn("flex items-center gap-1 px-1 py-1 text-xs font-medium rounded-lg transition-colors group cursor-pointer", tone.trigger)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select currency"
      >
        <span className="text-sm leading-none">{currentSymbol}</span>
        <span className="hidden sm:inline">{userCurrency}</span>
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
            aria-label="Currency"
            className={cn(
              "absolute top-full mt-1.5 min-w-[124px] overflow-hidden z-[1001]",
              tone.menu,
              tone.divider,
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            {CURRENCIES.map((currency) => {
              const selected = userCurrency === currency.code;
              return (
                <li key={currency.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => handleCurrencySelect(currency.code, currency.country)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide transition-colors cursor-pointer",
                      tone.item(selected)
                    )}
                  >
                    <span>{currency.code}</span>
                    <span className={cn("text-[13px] leading-none", tone.glyph(selected))}>
                      {currency.symbol}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CurrencySelector;
