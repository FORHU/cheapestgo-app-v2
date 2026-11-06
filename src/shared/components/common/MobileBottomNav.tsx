"use client";

import { useTranslations } from 'next-intl';
import React from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { Home, List, Settings2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignInDropdown from '@/shared/auth/SignInDropdown';
import { useChromeTone } from '@/shared/components/ChromeToneContext';

/**
 * Two skins, picked by the screen's chrome tone rather than by the app theme.
 *
 * On most screens the tone *is* the theme — light theme, light bar. The screen
 * that differs is the search map, which inverts all of its floating chrome so it
 * contrasts the basemap; the nav overlaps that map, so it inverts with the
 * toolbar and the cards instead of with the page. See ChromeToneContext for who
 * declares that and why the nav cannot decide it itself.
 *
 * Tone comes from context rather than a `dark:` variant because the search page
 * hardcodes `dark` on its own root — a Tailwind variant would resolve to the
 * dark skin there no matter what.
 *
 * The support chat button wears the same skin, so the two pieces of chrome read
 * as one set. It floats, so it takes `shadow`; the docked bar only casts upward
 * (`dockShadow`).
 */
export const NAV_SKIN = {
    dark: {
        bar:        '#181C24',
        border:     '1px solid rgba(255,255,255,0.06)',
        shadow:     '0 8px 30px rgba(0,0,0,0.28)',
        dockShadow: '0 -10px 30px rgba(0,0,0,0.22)',
        icon:       '#FFFFFF',
        active:     '#BB8E5E',
        divider:    'rgba(255,255,255,0.2)',
        ring:       'focus-visible:ring-white/40',
    },
    light: {
        bar:        '#FFFFFF',
        // A white bar on a light page has no contrast of its own to sit on, so
        // it takes a hairline the dark one does not need.
        border:     '1px solid rgba(17,17,17,0.08)',
        shadow:     '0 8px 30px rgba(15,23,42,0.16)',
        dockShadow: '0 -10px 30px rgba(15,23,42,0.10)',
        icon:       '#181C24',
        // The dark bar's bronze is 2.9:1 on white, under the 3:1 an icon needs,
        // so the light bar takes it a shade deeper.
        active:     '#9A6E3F',
        divider:    'rgba(24,28,36,0.14)',
        ring:       'focus-visible:ring-black/25',
    },
} as const;

const navItems = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Trips', icon: List, href: '/trips' },
    // No `/settings` route exists. The sheet this opens is already the account
    // surface — it carries Account settings and sign in/out — so the gear opens
    // it rather than linking somewhere that would 404.
    { label: 'Settings', icon: Settings2, href: null },
] as const;

export const MobileBottomNav = () => {
    const tAll = useTranslations();
    const pathname = usePathname();
    const skin = NAV_SKIN[useChromeTone()];
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);

    const activeIndex = React.useMemo(() => {
        if (isSheetOpen) return 2;
        if (pathname === '/' || pathname === '/flights/search') return 0;
        if (pathname === '/trips') return 1;
        return 0;
    }, [pathname, isSheetOpen]);

    if (pathname === '/ai-chat') return null;

    return (
        <>
            {/* Docked to the foot of the screen: flat bottom, rounded shoulders.
                The bar's own colour runs down under the home indicator, and the
                68px row above it stays clear of the 92px offset the support
                launcher and the other floating buttons keep. */}
            <nav
                aria-label={tAll('common.primary')}
                className="lg:hidden fixed bottom-0 inset-x-0 z-[100] rounded-t-[28px] pb-[env(safe-area-inset-bottom,0px)]"
                // Three longhands, not `border` plus `borderBottom: none`: React
                // warns on mixing a shorthand with its own longhand across rerenders,
                // and the search page rerenders this when the tone flips.
                style={{ background: skin.bar, borderTop: skin.border, borderLeft: skin.border, borderRight: skin.border, boxShadow: skin.dockShadow }}
            >
                <div className="flex h-[68px] items-center px-2">
                    {navItems.map((item, index) => {
                        const isActive = index === activeIndex;
                        const Icon = item.icon;

                        // Icons only, no labels: the active one turns bronze,
                        // the rest stay at full strength. The name is still
                        // there for screen readers, on the slot's aria-label.
                        const content = (
                            <span
                                className="transition-[color,transform] duration-200 group-active:scale-90 motion-reduce:transition-none motion-reduce:group-active:scale-100"
                                style={{ color: isActive ? skin.active : skin.icon }}
                            >
                                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                            </span>
                        );

                        // Thirds rather than `justify-around`: the tap target is
                        // the whole third, not just the glyph inside it. The ring
                        // is inset so it stays inside the bar's curved shoulders.
                        const slot = `group flex h-full flex-1 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-inset ${skin.ring}`;

                        const control = item.href === null ? (
                            <button
                                type="button"
                                onClick={() => setIsSheetOpen(v => !v)}
                                aria-expanded={isSheetOpen}
                                aria-label={item.label}
                                className={slot}
                            >
                                {content}
                            </button>
                        ) : (
                            <Link
                                href={item.href}
                                onClick={() => setIsSheetOpen(false)}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={item.label}
                                className={slot}
                            >
                                {content}
                            </Link>
                        );

                        return (
                            <React.Fragment key={item.label}>
                                {index > 0 && (
                                    <span aria-hidden="true" className="h-4 w-px shrink-0" style={{ background: skin.divider }} />
                                )}
                                {control}
                            </React.Fragment>
                        );
                    })}
                </div>
            </nav>

            <AnimatePresence>
                {isSheetOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSheetOpen(false)} className="fixed inset-0 bg-black/50 z-[101] lg:hidden" />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 z-[102] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl lg:hidden max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-3 shrink-0" />
                            <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tAll('common.settings')}</h2>
                                <button onClick={() => setIsSheetOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label={tAll('common.closeSettings')}>
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
                                <SignInDropdown variant="inline" onNavigate={() => setIsSheetOpen(false)} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
