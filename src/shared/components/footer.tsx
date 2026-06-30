import React from 'react';
import { PlaneTakeoff } from 'lucide-react';

export function Footer() {
    return (
        <footer className="w-full border-t border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
            <div className="max-w-[1400px] mx-auto px-5 py-6 lg:py-10 flex flex-col lg:flex-row justify-between items-start gap-6 lg:gap-8">
                {/* Brand */}
                <div className="flex flex-col gap-3 lg:gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg lg:bg-transparent lg:p-0">
                            <PlaneTakeoff className="w-4 h-4 lg:w-6 lg:h-6 text-blue-500" />
                        </div>
                        <span className="text-slate-900 dark:text-white font-bold text-[15px] lg:text-xl tracking-tight">
                            CheapestGo
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] lg:text-sm max-w-xs leading-relaxed">
                        Engineered for the discerning traveler.{' '}
                        <br className="hidden lg:block" />
                        Precision data. Zero compromise.
                        <br />
                        <span className="text-[9px] lg:text-xs mt-1.5 block font-medium">
                            Powered by Duffel, TravelgateX, &amp; Rakuten.
                        </span>
                    </p>
                </div>

                {/* Links grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-16 text-[10px] lg:text-sm w-full lg:w-auto">
                    <div className="flex flex-col gap-2 lg:gap-4">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">
                            Module
                        </span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <a href="/flights/search" className="text-slate-500 hover:text-blue-500 transition-colors">Flights</a>
                            <a href="/hotels/search" className="text-slate-500 hover:text-blue-500 transition-colors">Hotels</a>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:gap-4">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">
                            Company
                        </span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <a href="#" className="text-slate-500 hover:text-blue-500 transition-colors">About Us</a>
                            <a href="#" className="text-slate-500 hover:text-blue-500 transition-colors">Enterprise</a>
                            <a href="mailto:support@cheapestgo.com" className="text-slate-500 hover:text-blue-500 transition-colors">Support</a>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:gap-4 col-span-2 sm:col-span-1">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">
                            Network
                        </span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Flights API
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Payment Gateway
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legal bar */}
            <div className="border-t border-slate-100 dark:border-white/5 px-5 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 text-[10px] lg:text-xs text-slate-400 dark:text-slate-500">
                <span className="order-2 lg:order-1 opacity-70">© 2026 JTP Partners. All rights reserved.</span>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 order-1 lg:order-2">
                    <a href="/terms" className="hover:text-blue-500 transition-colors">Terms</a>
                    <a href="/privacy" className="hover:text-blue-500 transition-colors">Privacy</a>
                    <a href="/cookies" className="hover:text-blue-500 transition-colors">Cookies</a>
                    <a href="/refund" className="hover:text-blue-500 transition-colors">Refunds</a>
                    <a href="mailto:support@cheapestgo.com" className="hover:text-blue-500 transition-colors">Contact</a>
                </div>
            </div>
        </footer>
    );
}
