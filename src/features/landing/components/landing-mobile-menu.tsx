'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Settings, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useLogout } from '@/features/auth/hooks/use-auth';
import type { SelectorVariant } from '@/shared/components/common/selector-tone';
import { ACCOUNT_PANEL_SKIN, AccountAvatar, FILL_BUTTON, getInitials } from '@/shared/auth/SignInDropdown';

/**
 * Hamburger by tone. White on the landing page rather than the menus' slate-400: at this width
 * it is the only control on the bar, and it has to be found over the hero photograph.
 */
const TRIGGER: Record<SelectorVariant, string> = {
    onDark: 'text-white hover:bg-white/[0.08] focus-visible:ring-white/40',
    default: 'text-slate-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 focus-visible:ring-black/25 dark:focus-visible:ring-white/40',
};

/**
 * The landing header's sign in below 761px, where the header drops its row of controls: a
 * hamburger that opens sign in for a guest, and the account and sign out once signed in.
 *
 * The panel is the desktop profile menu's material (`SignInDropdown`), so it reads as the same
 * control at a different width. Sign in goes to the full-page /login screen, as the desktop
 * header's does.
 */
export function LandingMobileMenu({ tone }: { tone: SelectorVariant }) {
    const tAll = useTranslations();
    const user = useAuthStore((s) => s.user);
    const signOut = useLogout();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const skin = ACCOUNT_PANEL_SKIN[tone];

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const close = () => setOpen(false);
    const Icon = open ? X : Menu;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={tAll('nav.menu')}
                aria-expanded={open}
                aria-controls={panelId}
                className={cn(
                    'flex size-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2',
                    TRIGGER[tone],
                )}
            >
                <Icon size={24} strokeWidth={2} aria-hidden />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        id={panelId}
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        style={{ transformOrigin: 'top right' }}
                        className={cn('absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden', skin.panel)}
                    >
                        {user ? (
                            <>
                                <div className={cn('flex items-center gap-3 border-b p-4', skin.hairline)}>
                                    <AccountAvatar
                                        initials={getInitials(user.firstName, user.lastName, user.email)}
                                        className={cn('size-10 text-sm', skin.avatarRing)}
                                    />
                                    <div className="min-w-0">
                                        <p className={cn('truncate text-sm font-medium', skin.title)}>
                                            {user.firstName} {user.lastName}
                                        </p>
                                        <p className={cn('truncate text-xs', skin.muted)}>{user.email}</p>
                                    </div>
                                </div>
                                <div className="py-2">
                                    <Link
                                        href="/account"
                                        onClick={close}
                                        className={cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors', skin.row)}
                                    >
                                        <Settings className={cn('size-5', skin.icon)} aria-hidden />
                                        {tAll('nav.accountSettings')}
                                    </Link>
                                </div>
                                <div className={cn('border-t p-2', skin.hairline)}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            close();
                                            signOut.mutate();
                                        }}
                                        disabled={signOut.isPending}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors disabled:opacity-50',
                                            skin.danger,
                                        )}
                                    >
                                        <LogOut className="size-5" aria-hidden />
                                        {tAll('nav.signOut')}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="p-4">
                                <Link
                                    href="/login"
                                    onClick={close}
                                    className={cn('block w-full rounded-full px-4 py-3 text-center text-sm font-semibold', FILL_BUTTON)}
                                >
                                    {tAll('nav.signIn')}
                                </Link>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
