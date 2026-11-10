'use client';

import React, { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { Locale } from '@/i18n/routing';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useTheme } from '@/shared/components/ThemeContext';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { useLocaleSwitch } from '@/shared/components/common/LocaleSelector';
import { CURRENCIES, useCurrencySwitch } from '@/shared/components/common/CurrencySelector';

/**
 * What the phone's settings sheet holds (the bottom bar's gear): the language, the currency and
 * the theme, and once someone is signed in, their account — its settings and sign out.
 *
 * Not sign in: that is the header's button, on every screen that has one. Language and currency
 * are here because a phone's header has no room for the menus a desktop's carries, and they
 * change exactly as those menus do (`useLocaleSwitch`, `useCurrencySwitch`).
 *
 * Each is a short row of buttons rather than a dropdown inside a sheet: four languages and five
 * currencies fit across a phone, and one tap beats two. The one in use wears the brand's
 * gradient, as the landing page's Stays / Flights / Golf tabs do.
 */

/** Each language in itself, as a speaker of it looks for it — not in the language on screen. */
const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'ko', name: '한국어' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' },
] as const satisfies ReadonlyArray<{ code: Locale; name: string }>;

const CHIP = 'flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40';
const CHIP_OFF = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10';
const CHIP_ON = 'border-transparent bg-linear-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-600/25';

function Choices({ label, columns, children }: { label: string; columns: string; children: React.ReactNode }) {
    const id = useId();
    return (
        <section>
            <h3 id={id} className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </h3>
            <div role="group" aria-labelledby={id} className={cn('grid gap-2', columns)}>
                {children}
            </div>
        </section>
    );
}

function Choice({ on, onPick, lang, children }: {
    on: boolean;
    onPick: () => void;
    lang?: string;
    children: React.ReactNode;
}) {
    return (
        <button type="button" aria-pressed={on} onClick={onPick} lang={lang} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}>
            {children}
        </button>
    );
}

export function SettingsPanel({ onNavigate }: { onNavigate: () => void }) {
    const tAll = useTranslations();
    const user = useAuthStore((s) => s.user);
    const { theme, toggleTheme } = useTheme();
    const { locale, select: selectLocale } = useLocaleSwitch();
    const { currency, select: selectCurrency } = useCurrencySwitch();

    return (
        <div className="space-y-6">
            {user && (
                <div className="border-b border-slate-100 pb-6 dark:border-slate-800">
                    <SignInDropdown variant="inline" onNavigate={onNavigate} />
                </div>
            )}

            <Choices label={tAll('common.language')} columns="grid-cols-4">
                {LANGUAGES.map(({ code, name }) => (
                    <Choice key={code} on={code === locale} onPick={() => selectLocale(code)} lang={code}>
                        {name}
                    </Choice>
                ))}
            </Choices>

            <Choices label={tAll('common.currency')} columns="grid-cols-5">
                {CURRENCIES.map(({ code, country, symbol }) => (
                    <Choice key={code} on={code === currency} onPick={() => selectCurrency(code, country)}>
                        <span aria-hidden className="opacity-70">{symbol}</span>
                        {code}
                    </Choice>
                ))}
            </Choices>

            <Choices label={tAll('common.theme')} columns="grid-cols-2">
                <Choice on={theme === 'light'} onPick={() => theme !== 'light' && toggleTheme()}>
                    <Sun className="size-4" aria-hidden />
                    {tAll('common.themeLight')}
                </Choice>
                <Choice on={theme === 'dark'} onPick={() => theme !== 'dark' && toggleTheme()}>
                    <Moon className="size-4" aria-hidden />
                    {tAll('common.themeDark')}
                </Choice>
            </Choices>
        </div>
    );
}
