"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/store';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    if (first || last) return (first + last).toUpperCase();
    return (email?.[0] ?? '?').toUpperCase();
}

interface SignInDropdownProps {
    variant?: 'dropdown' | 'inline';
    collapsible?: boolean;
    onNavigate?: () => void;
    onToggleOpen?: (open: boolean) => void;
}

const SignInDropdownContent: React.FC<SignInDropdownProps> = ({ variant = 'dropdown', collapsible = false, onNavigate, onToggleOpen }) => {
    const { user, logout } = useAuthStore();
    const t = useTranslations('nav');
    const [isOpen, setIsOpen] = useState(false);
    const [isInlineOpen, setIsInlineOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => { setMounted(true); }, []);

    const getRedirectLink = (base: string = '/login', mode?: string) => {
        const params = new URLSearchParams();
        if (mode) params.set('mode', mode);
        if (pathname !== '/' && pathname !== '/login') {
            params.set('redirect', pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''));
        }
        const queryString = params.toString();
        return queryString ? `${base}?${queryString}` : base;
    };

    const setInlineOpen = (open: boolean) => {
        setIsInlineOpen(open);
        onToggleOpen?.(open);
    };

    useEffect(() => {
        if (variant === 'inline') return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [variant]);

    useEffect(() => {
        if (variant === 'inline') return;
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [variant]);

    const handleNav = () => { setIsOpen(false); setIsInlineOpen(false); onNavigate?.(); };

    if (variant === 'inline') {
        const inlineContent = (mounted && user) ? (
            <>
                <div className="flex items-center gap-3">
                    <div className="size-8 shrink-0 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-[clamp(0.65rem,1.5vw,0.75rem)]">
                        {getInitials(user.firstName, user.lastName, user.email)}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-[clamp(0.8125rem,1.5vw,0.875rem)] text-slate-900 dark:text-white truncate">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-[clamp(0.6875rem,1.25vw,0.75rem)] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                </div>
                <div className="space-y-0.5">
                    <Link href="/account" onClick={handleNav} className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <Settings className="h-5 w-5 text-slate-400" />
                        {t('accountSettings')}
                    </Link>
                </div>
                <button
                    onClick={async () => {
                        try {
                            await logout();
                            handleNav();
                        } catch (e) { console.error('Error during logout', e); }
                        finally { window.location.href = '/'; }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    {t('signOut')}
                </button>
            </>
        ) : (
            <div className="space-y-3">
                <Link href={getRedirectLink('/login')} onClick={handleNav} className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-colors text-center shadow-lg shadow-blue-500/20">
                    {t('signIn')}
                </Link>
                <Link href={getRedirectLink('/login', 'signup')} onClick={handleNav} className="block w-full py-3 px-4 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm font-semibold rounded-full hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-center">
                    {t('createAccount')}
                </Link>
            </div>
        );

        if (collapsible) {
            return (
                <div className="w-full">
                    <button type="button" onClick={() => setInlineOpen(!isInlineOpen)} className="flex items-center justify-between w-full min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm">
                        <span>{(mounted && user) ? t('account') : t('signIn')}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isInlineOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {isInlineOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">{inlineContent}</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        }

        return <div className="space-y-3">{inlineContent}</div>;
    }

    if (!mounted || !user) {
        return (
            <div ref={dropdownRef} className="relative">
                <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors shrink-0">
                    Sign in
                </button>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-full min-w-[280px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden z-50">
                            <div className="p-4 bg-linear-to-r from-blue-600 to-blue-700 text-white">
                                <p className="font-medium text-[clamp(0.875rem,2vw,1rem)]">{t('membersSave')}</p>
                                <p className="text-[clamp(0.8125rem,1.5vw,0.875rem)] text-blue-100 mt-1">{t('membersSaveSubtitle')}</p>
                            </div>
                            <div className="p-4 space-y-3">
                                <Link href={getRedirectLink('/login')} onClick={handleNav} className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-[clamp(0.8125rem,1.5vw,0.875rem)] font-medium rounded-full transition-colors text-center">
                                    {t('signIn')}
                                </Link>
                                <Link href={getRedirectLink('/login', 'signup')} onClick={handleNav} className="block w-full py-3 px-4 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-[clamp(0.8125rem,1.5vw,0.875rem)] font-medium rounded-full hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-center">
                                    {t('createAccount')}
                                </Link>
                            </div>
                            <div className="border-t border-slate-100 dark:border-white/5 p-4">
                                <p className="text-[clamp(0.6875rem,1.25vw,0.75rem)] text-slate-500 dark:text-slate-400 text-center">{t('accountWorks')}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
                <div className="size-7 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-[10px]">
                    {getInitials(user.firstName, user.lastName, user.email)}
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-full min-w-[280px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden z-50">
                        <div className="p-4 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="size-10 shrink-0 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-[clamp(0.875rem,2vw,1rem)]">
                                    {getInitials(user.firstName, user.lastName, user.email)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                </div>
                            </div>
                        </div>
                        <div className="py-2">
                            <Link href="/account" className="flex items-center gap-3 px-4 py-2.5 text-[clamp(0.8125rem,1.5vw,0.875rem)] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={handleNav}>
                                <Settings className="h-5 w-5 text-slate-400" />
                                {t('accountSettings')}
                            </Link>
                        </div>
                        <div className="border-t border-slate-100 dark:border-white/5 p-2">
                            <button onClick={async () => { await logout(); window.location.href = '/'; }} className="w-full flex items-center gap-3 px-3 py-2.5 text-[clamp(0.8125rem,1.5vw,0.875rem)] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                                <LogOut className="h-5 w-5" />
                                {t('signOut')}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SignInDropdown: React.FC<SignInDropdownProps> = (props) => (
    <Suspense fallback={null}>
        <SignInDropdownContent {...props} />
    </Suspense>
);

export default SignInDropdown;
