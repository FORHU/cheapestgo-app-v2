"use client";

import React from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { Home, List, Settings, X } from 'lucide-react';
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
 */
const NAV_SKIN = {
    dark: {
        bar:    '#1C1C1E',
        border: '1px solid rgba(255,255,255,0.06)',
        shadow: '0 8px 30px rgba(0,0,0,0.28)',
        on:     '#FFFFFF',
        off:    'rgba(255,255,255,0.45)',
        ring:   'focus-visible:ring-white/40',
    },
    light: {
        bar:    '#FFFFFF',
        // A white bar on a light page has no contrast of its own to sit on, so
        // it takes a hairline the dark one does not need.
        border: '1px solid rgba(17,17,17,0.08)',
        shadow: '0 8px 30px rgba(15,23,42,0.16)',
        on:     '#111111',
        off:    'rgba(17,17,17,0.42)',
        ring:   'focus-visible:ring-black/25',
    },
} as const;

const navItems = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Trips', icon: List, href: '/trips' },
    // No `/settings` route exists. The sheet this opens is already the account
    // surface — it carries Account settings and sign in/out — so the gear opens
    // it rather than linking somewhere that would 404.
    { label: 'Settings', icon: Settings, href: null },
] as const;

export const MobileBottomNav = () => {
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
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
                <nav
                    aria-label="Primary"
                    className="flex items-stretch rounded-full"
                    style={{ background: skin.bar, border: skin.border, boxShadow: skin.shadow }}
                >
                    {navItems.map((item, index) => {
                        const isActive = index === activeIndex;
                        const Icon = item.icon;

                        // Icon and label share one colour and change together —
                        // the design carries the state in tone alone, with no
                        // pill, underline or indicator behind the active item.
                        const content = (
                            <span
                                className="flex w-full flex-col items-center justify-center gap-1.5 py-3.5 transition-colors duration-200"
                                style={{ color: isActive ? skin.on : skin.off }}
                            >
                                <Icon size={24} strokeWidth={2} aria-hidden="true" />
                                <span className="text-[12px] font-medium leading-none">{item.label}</span>
                            </span>
                        );

                        // Thirds rather than `justify-around`: the tap target is
                        // the whole third, not just the glyph inside it.
                        // `rounded-full` so the focus ring follows the pill's own
                        // curve at the two ends rather than cutting across it.
                        const slot = `flex-1 outline-none rounded-full focus-visible:ring-2 ${skin.ring}`;

                        if (item.href === null) {
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => setIsSheetOpen(v => !v)}
                                    aria-expanded={isSheetOpen}
                                    className={slot}
                                >
                                    {content}
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setIsSheetOpen(false)}
                                aria-current={isActive ? 'page' : undefined}
                                className={slot}
                            >
                                {content}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <AnimatePresence>
                {isSheetOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSheetOpen(false)} className="fixed inset-0 bg-black/50 z-[101] lg:hidden" />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 z-[102] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl lg:hidden max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-3 shrink-0" />
                            <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h2>
                                <button onClick={() => setIsSheetOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Close settings">
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
