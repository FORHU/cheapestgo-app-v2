"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, PlaneTakeoff, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import SignInDropdown from '@/shared/auth/SignInDropdown';

const navItems = [
    { label: 'Home', icon: Search, href: '/' },
    { label: 'Trips', icon: PlaneTakeoff, href: '/trips' },
    { label: 'Profile', icon: User, href: '#profile' },
];

export const MobileBottomNav = () => {
    const pathname = usePathname();
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);

    const activeIndex = React.useMemo(() => {
        if (isProfileOpen) return 2;
        if (pathname === '/' || pathname === '/flights/search') return 0;
        if (pathname === '/trips') return 1;
        return 0;
    }, [pathname, isProfileOpen]);

    if (pathname === '/ai-chat') return null;

    return (
        <>
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+6px)]">
                <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-15px_40px_rgba(0,0,0,0.25)] border border-white/20 dark:border-white/10 h-11 flex items-center">
                    <motion.div
                        className="absolute top-0 h-full w-[33.33%] flex justify-center"
                        animate={{ x: `${activeIndex * 100}%` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    >
                        <div className="absolute -top-5 w-16 h-16 bg-transparent flex justify-center">
                            <svg className="absolute top-4 w-[130%] h-8 fill-white dark:fill-slate-900" viewBox="0 0 100 40">
                                <path d="M 0 40 Q 20 40 25 30 Q 30 15 50 15 Q 70 15 75 30 Q 80 40 100 40" />
                            </svg>
                            <motion.div
                                className="relative size-9 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center border-[2px] border-alabaster dark:border-obsidian"
                                layoutId="active-circle"
                            >
                                <div className="text-blue-600 dark:text-blue-400">
                                    {React.createElement(navItems[activeIndex].icon, { size: 16, strokeWidth: 2.5 })}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    <nav className="flex items-center justify-around w-full relative z-10">
                        {navItems.map((item, index) => {
                            const isProfile = item.label === 'Profile';
                            const isActive = index === activeIndex;

                            const content = (
                                <div className="relative flex flex-col items-center gap-0.5 transition-all duration-300">
                                    <div className={cn("transition-all duration-300", isActive ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0")}>
                                        <item.icon size={16} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <span className={cn("text-[8px] font-bold transition-all duration-300", isActive ? "text-blue-600 dark:text-blue-400 translate-y-0.5" : "text-slate-400 dark:text-slate-500")}>
                                        {item.label}
                                    </span>
                                </div>
                            );

                            if (isProfile) {
                                return (
                                    <button key={item.label} onClick={() => setIsProfileOpen(!isProfileOpen)} className="relative outline-none w-1/3 py-2">
                                        {content}
                                    </button>
                                );
                            }

                            return (
                                <Link key={item.label} href={item.href} onClick={() => setIsProfileOpen(false)} className="outline-none w-1/3 py-2">
                                    {content}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <AnimatePresence>
                {isProfileOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="fixed inset-0 bg-black/50 z-[101] lg:hidden" />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 z-[102] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl lg:hidden max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-3 shrink-0" />
                            <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile</h2>
                                <button onClick={() => setIsProfileOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
                                <SignInDropdown variant="inline" onNavigate={() => setIsProfileOpen(false)} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
