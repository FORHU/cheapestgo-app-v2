'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, PlaneTakeoff, User, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/shared/auth/store';
import { useUserCurrency, useSearchStore } from '@/shared/stores/search.store';
import { CURRENCIES } from '@/shared/lib/currency';
import { cn } from '@/shared/lib/cn';

// ─── Currency Selector ────────────────────────────────────────────────────────
function CurrencySelector() {
    const currency = useUserCurrency();
    const { setUserCurrency } = useSearchStore();
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
                {currency}
                <ChevronDown size={10} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                    {CURRENCIES.map((c) => (
                        <button
                            key={c.code}
                            onClick={() => { setUserCurrency(c.code); setOpen(false); }}
                            className={cn(
                                'w-full text-left px-4 py-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-white/5',
                                currency === c.code
                                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-slate-700 dark:text-slate-300'
                            )}
                        >
                            <span className="font-mono mr-2">{c.code}</span>
                            <span className="text-slate-400">{c.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── User Menu ────────────────────────────────────────────────────────────────
function UserMenu() {
    const { user, logout } = useAuthStore();
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (!user) {
        return (
            <Link
                href="/login"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
                Sign in
            </Link>
        );
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
                <div className="size-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                    {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{user.first_name || user.email}</span>
                <ChevronDown size={10} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                    <Link
                        href="/account"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <User size={14} />
                        My Account
                    </Link>
                    <Link
                        href="/trips"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <PlaneTakeoff size={14} />
                        My Trips
                    </Link>
                    <div className="border-t border-slate-100 dark:border-white/5">
                        <button
                            onClick={() => { logout(); setOpen(false); }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="size-7" />;
    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Toggle theme"
        >
            {theme === 'dark'
                ? <Sun className="w-4 h-4 text-slate-300" />
                : <Moon className="w-4 h-4 text-slate-700" />
            }
        </button>
    );
}

// ─── Nav Links ────────────────────────────────────────────────────────────────
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const pathname = usePathname();
    const isActive = pathname === href;
    return (
        <Link
            href={href}
            className={cn(
                'flex items-center px-2 py-1 text-[10px] sm:text-xs font-medium rounded-lg transition-colors',
                isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
            )}
        >
            {children}
        </Link>
    );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function HeaderContent() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl transition-colors">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-11 md:h-14 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
                    <h1 className="text-base sm:text-lg md:text-xl text-slate-900 dark:text-white font-bold tracking-tight">
                        Cheapest<span className="text-blue-600 dark:text-blue-400">Go</span>
                    </h1>
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-1 sm:gap-2">
                    <NavLink href="/trips">Trips</NavLink>
                    <a
                        href="mailto:support@cheapestgo.com"
                        className="hidden xs:flex items-center px-2 py-1 text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Support
                    </a>
                    <CurrencySelector />
                    <ThemeToggle />
                    <div className="hidden lg:block shrink-0">
                        <UserMenu />
                    </div>
                </nav>
            </div>
        </header>
    );
}

export function Header() {
    return (
        <Suspense fallback={null}>
            <HeaderContent />
        </Suspense>
    );
}
