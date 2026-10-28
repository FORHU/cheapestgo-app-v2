"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore, useAuthStore as useModalStore } from '@/shared/stores/auth.store';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { cn } from '@/shared/lib/cn';
import { SELECTOR_TONES, type SelectorVariant } from '@/shared/components/common/selector-tone';

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    if (first || last) return (first + last).toUpperCase();
    return (email?.[0] ?? '?').toUpperCase();
}

/**
 * The brand's one gradient, blue-600 → cyan-500 (`BRAND.gradient`): the profile circle and
 * every filled button here wear it, as they do everywhere else in the app. The circle was
 * blue → purple, a colour the brand does not have.
 */
const FILL = 'bg-linear-to-r from-blue-600 to-cyan-500';
const FILL_BUTTON = `${FILL} text-white shadow-lg shadow-blue-600/30 transition-[filter] hover:brightness-110`;

/**
 * What the panel's text, rows and hairlines are drawn in, by tone.
 *
 * The panel itself is the same glass as the language and currency menus
 * (`SELECTOR_TONES`), so the three header menus read as one material. `onDark` is for a header
 * that is dark whatever the app theme is — the landing page's — where the themed skin would
 * draw a light panel over a dark page.
 */
const SKIN: Record<SelectorVariant, {
    panel: string; title: string; muted: string; row: string; icon: string;
    hairline: string; outlineButton: string; danger: string; avatarRing: string;
}> = {
    default: {
        panel: SELECTOR_TONES.default.menu,
        title: 'text-slate-900 dark:text-white',
        muted: 'text-slate-600 dark:text-white/60',
        row: 'text-slate-800 dark:text-white/85 hover:bg-white/50 dark:hover:bg-white/10',
        icon: 'text-slate-500 dark:text-white/60',
        hairline: 'border-slate-900/10 dark:border-white/10',
        outlineButton: 'border border-slate-900/15 dark:border-white/20 text-slate-800 dark:text-white hover:bg-white/50 dark:hover:bg-white/10',
        danger: 'text-red-600 dark:text-red-300 hover:bg-red-500/10',
        avatarRing: '',
    },
    onDark: {
        // Not the language menu's 18% white: that is a list of one word a row, and this panel
        // holds a name, an address and a sign-out, so over a bright photograph the rows behind
        // it showed through the text. The slate-900 the search bar's own dropdowns use,
        // blurred, holds white text over anything.
        panel: 'rounded-[20px] bg-[#0f172a]/90 backdrop-blur-[18px] backdrop-saturate-150 border border-white/10 shadow-[0_26px_55px_-18px_rgba(0,0,0,0.7)]',
        title: 'text-white',
        muted: 'text-white/60',
        row: 'text-white/85 hover:bg-white/[0.08]',
        icon: 'text-white/60',
        hairline: 'border-white/10',
        outlineButton: 'border border-white/25 text-white hover:bg-white/[0.08]',
        danger: 'text-red-400 hover:bg-red-500/15',
        avatarRing: 'ring-1 ring-white/25',
    },
};

function Avatar({ initials, className }: { initials: string; className: string }) {
    return (
        <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', FILL, className)}>
            {initials}
        </div>
    );
}

interface SignInDropdownProps {
    variant?: 'dropdown' | 'inline';
    /** The skin of the dropdown's trigger and panel. `onDark` on a page that is dark whatever
     *  the app theme is; the default follows the theme. */
    tone?: SelectorVariant;
    collapsible?: boolean;
    onNavigate?: () => void;
    onToggleOpen?: (open: boolean) => void;
}

const SignInDropdownContent: React.FC<SignInDropdownProps> = ({ variant = 'dropdown', tone = 'default', collapsible = false, onNavigate, onToggleOpen }) => {
    const tAll = useTranslations();
    const { user } = useAuthStore();
    const openAuthModal = useModalStore((state) => state.openAuthModal);
    const signOut = useLogout();
    const t = useTranslations('nav');
    const [isOpen, setIsOpen] = useState(false);
    const [isInlineOpen, setIsInlineOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const skin = SKIN[tone];

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
    const handleSignOut = () => {
        handleNav();
        signOut.mutate();
    };

    if (variant === 'inline') {
        const inlineContent = (mounted && user) ? (
            <>
                <div className="flex items-center gap-3">
                    <Avatar initials={getInitials(user.firstName, user.lastName, user.email)} className="size-8 text-[clamp(0.65rem,1.5vw,0.75rem)]" />
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
                    type="button"
                    onClick={handleSignOut}
                    disabled={signOut.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    {t('signOut')}
                </button>
            </>
        ) : (
            <div className="space-y-3">
                <button type="button" onClick={() => { handleNav(); openAuthModal('email'); }} className={cn('block w-full py-3 px-4 text-sm font-bold rounded-full text-center', FILL_BUTTON)}>
                    {t('signIn')}
                </button>
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

    const panelMotion = {
        initial: { opacity: 0, y: -8, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.96 },
        transition: { duration: 0.15 },
    } as const;
    const panelClass = cn('absolute right-0 top-full mt-2 w-full min-w-[280px] overflow-hidden z-50', skin.panel);

    if (!mounted || !user) {
        return (
            <div ref={dropdownRef} className="relative">
                <button onClick={() => setIsOpen(!isOpen)} className={cn('flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full shrink-0', FILL_BUTTON)}>
                    {tAll('nav.signIn')}
                </button>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div {...panelMotion} className={panelClass}>
                            <div className={cn('p-4 text-white', FILL)}>
                                <p className="font-medium text-[clamp(0.875rem,2vw,1rem)]">{t('membersSave')}</p>
                                <p className="text-[clamp(0.8125rem,1.5vw,0.875rem)] text-white/85 mt-1">{t('membersSaveSubtitle')}</p>
                            </div>
                            <div className="p-4 space-y-3">
                                <button type="button" onClick={() => { handleNav(); openAuthModal('email'); }} className={cn('block w-full py-3 px-4 text-[clamp(0.8125rem,1.5vw,0.875rem)] font-medium rounded-full text-center', FILL_BUTTON)}>
                                    {t('signIn')}
                                </button>
                                <Link href={getRedirectLink('/login', 'signup')} onClick={handleNav} className={cn('block w-full py-3 px-4 text-[clamp(0.8125rem,1.5vw,0.875rem)] font-medium rounded-full transition-colors text-center', skin.outlineButton)}>
                                    {t('createAccount')}
                                </Link>
                            </div>
                            <div className={cn('border-t p-4', skin.hairline)}>
                                <p className={cn('text-[clamp(0.6875rem,1.25vw,0.75rem)] text-center', skin.muted)}>{t('accountWorks')}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative">
            <button onClick={() => setIsOpen(!isOpen)} aria-label={t('account')} aria-expanded={isOpen} className={cn('flex items-center gap-2 p-1 rounded-full transition-colors shrink-0', SELECTOR_TONES[tone].trigger)}>
                <Avatar initials={getInitials(user.firstName, user.lastName, user.email)} className={cn('size-7 text-[10px]', skin.avatarRing)} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div {...panelMotion} className={panelClass}>
                        <div className={cn('p-4 border-b', skin.hairline)}>
                            <div className="flex items-center gap-3">
                                <Avatar initials={getInitials(user.firstName, user.lastName, user.email)} className={cn('size-10 text-[clamp(0.875rem,2vw,1rem)]', skin.avatarRing)} />
                                <div className="min-w-0">
                                    <p className={cn('font-medium text-sm truncate', skin.title)}>{user.firstName} {user.lastName}</p>
                                    <p className={cn('text-xs truncate', skin.muted)}>{user.email}</p>
                                </div>
                            </div>
                        </div>
                        <div className="py-2">
                            <Link href="/account" className={cn('flex items-center gap-3 px-4 py-2.5 text-[clamp(0.8125rem,1.5vw,0.875rem)] transition-colors', skin.row)} onClick={handleNav}>
                                <Settings className={cn('h-5 w-5', skin.icon)} />
                                {t('accountSettings')}
                            </Link>
                        </div>
                        <div className={cn('border-t p-2', skin.hairline)}>
                            <button type="button" onClick={handleSignOut} disabled={signOut.isPending} className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-[clamp(0.8125rem,1.5vw,0.875rem)] rounded-lg transition-colors disabled:opacity-50', skin.danger)}>
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
