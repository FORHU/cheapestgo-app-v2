"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useUserCurrency, useSearchActions } from '@/shared/stores/search.store';
import { SELECTOR_TONES, type SelectorChrome, type SelectorVariant } from '@/shared/components/common/selector-tone';
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
  /**
   * Draw from these colours instead of `variant`'s classes. See
   * `SelectorChrome` — it is for chrome that is not the app theme, which no
   * `dark:` variant can follow.
   */
  chrome?: SelectorChrome;
  /**
   * Collapse the trigger to a circle carrying the active currency's symbol
   * alone — no code, no chevron.
   *
   * For a toolbar whose other controls are all icon circles, where a labelled
   * pill is the one thing on the bar with a different silhouette. The symbol
   * stays rather than becoming a generic money glyph: it is what the prices on
   * screen are already printed in, so it says which currency is on without
   * costing a character more than an icon would.
   */
  iconOnly?: boolean;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  className,
  align = 'right',
  variant = 'default',
  chrome,
  iconOnly = false,
}) => {
  const tone = SELECTOR_TONES[variant];
  /**
   * Row hover, in state rather than in CSS.
   *
   * The chrome path paints rows from inline styles, and an inline background
   * outranks any `hover:` class that would otherwise cover this.
   */
  const [hovered, setHovered] = useState<string | null>(null);
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
        className={cn(
          "flex items-center text-xs font-medium transition-colors group cursor-pointer",
          chrome
            // On chrome the trigger is a control on a toolbar, so it takes the
            // toolbar's own geometry — the icon circle its neighbours are drawn
            // at, or the same height as a pill when it still carries a label.
            ? iconOnly
              ? "h-6 w-6 shrink-0 justify-center rounded-full hover:opacity-80 md:h-7 md:w-7"
              : "h-6 gap-1 rounded-full px-2 hover:opacity-80 md:h-7 md:px-2.5"
            : cn("gap-1 px-1 py-1 rounded-lg", tone.trigger),
        )}
        style={chrome ? { background: chrome.surface, border: `1px solid ${chrome.border}`, color: chrome.text } : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={iconOnly ? `Currency: ${userCurrency}` : 'Select currency'}
      >
        <span className={cn("leading-none", iconOnly ? "text-[13px] font-semibold md:text-sm" : "text-sm")}>
          {currentSymbol}
        </span>
        {!iconOnly && (
          <>
            <span className="hidden sm:inline">{userCurrency}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
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
              chrome ? "rounded-2xl" : cn(tone.menu, tone.divider),
              align === 'right' ? 'right-0' : 'left-0'
            )}
            style={chrome ? { background: chrome.menu, border: `1px solid ${chrome.border}`, boxShadow: chrome.shadow } : undefined}
          >
            {CURRENCIES.map((currency) => {
              const selected = userCurrency === currency.code;
              return (
                <li key={currency.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => handleCurrencySelect(currency.code, currency.country)}
                    onMouseEnter={chrome ? () => setHovered(currency.code) : undefined}
                    onMouseLeave={chrome ? () => setHovered(null) : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide transition-colors cursor-pointer",
                      !chrome && tone.item(selected)
                    )}
                    style={chrome ? {
                      background: selected || hovered === currency.code ? chrome.hover : 'transparent',
                      color: chrome.text,
                    } : undefined}
                  >
                    <span>{currency.code}</span>
                    <span className={cn("text-[13px] leading-none", !chrome && tone.glyph(selected))}>
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
