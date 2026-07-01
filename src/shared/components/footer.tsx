"use client";

import React, { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PlaneTakeoff } from 'lucide-react';
import { useTranslations } from 'next-intl';

const StandardFooter = () => {
    const t = useTranslations('footer');
    return (
        <footer className="w-full border-t border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md landscape-compact-py">
            <div className="max-w-[1400px] mx-auto px-5 py-3 lg:py-10 landscape:py-2 flex flex-col lg:flex-row justify-between items-start gap-5 lg:gap-8">
                <div className="flex flex-col gap-2 lg:gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg lg:bg-transparent lg:p-0">
                            <PlaneTakeoff className="w-4 h-4 lg:w-6 lg:h-6 text-blue-500 lg:text-slate-400" />
                        </div>
                        <span className="text-slate-900 dark:text-white font-bold text-[15px] lg:text-xl tracking-tight">CheapestGo</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] lg:text-sm max-w-xs leading-relaxed opacity-80 lg:opacity-100">
                        {t('tagline')} <br className="hidden lg:block" />{t('taglinePrecision')}
                        <br /><span className="text-[9px] lg:text-xs mt-1.5 block font-medium">{t('poweredBy')}</span>
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-16 text-[10px] lg:text-sm w-full lg:w-auto">
                    <div className="flex flex-col gap-2 lg:gap-4">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">{t('module')}</span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <a href="/flights/search" className="text-slate-500 hover:text-blue-500 transition-colors">{t('flights')}</a>
                            <a href="/hotels/search" className="text-slate-500 hover:text-blue-500 transition-colors">{t('hotels')}</a>
                            <a href="#" className="text-slate-500 hover:text-blue-500 transition-colors">{t('cars')}</a>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:gap-4">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">{t('company')}</span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <a href="#" className="text-slate-500 hover:text-blue-500 transition-colors">{t('aboutUs')}</a>
                            <a href="#" className="text-slate-500 hover:text-blue-500 transition-colors">{t('enterprise')}</a>
                            <a href="mailto:support@cheapestgo.com" className="text-slate-500 hover:text-blue-500 transition-colors">{t('support')}</a>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:gap-4 col-span-2 sm:col-span-1">
                        <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider text-[9px] lg:text-xs">{t('network')}</span>
                        <div className="flex flex-col gap-1.5 lg:gap-3">
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {t('flightsApi')}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {t('paymentGateway')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-100 dark:border-white/5 px-5 py-6 lg:py-4 flex flex-col lg:flex-row items-center justify-between gap-4 text-[10px] lg:text-xs text-slate-400 dark:text-slate-500">
                <span className="order-2 lg:order-1 opacity-70">{t('copyright')}</span>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 order-1 lg:order-2">
                    <a href="/terms-of-service" className="hover:text-blue-500 transition-colors">{t('terms')}</a>
                    <a href="/privacy-policy" className="hover:text-blue-500 transition-colors">{t('privacy')}</a>
                    <a href="/cookie-policy" className="hover:text-blue-500 transition-colors">{t('cookies')}</a>
                    <a href="mailto:support@cheapestgo.com" className="hover:text-blue-500 transition-colors">{t('contact')}</a>
                </div>
            </div>
        </footer>
    );
};

const FooterContent = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isMapView = pathname === '/search' && searchParams?.get('view') === 'map';
    if (isMapView) return null;
    return <StandardFooter />;
};

export function Footer() {
    return (
        <Suspense fallback={<StandardFooter />}>
            <FooterContent />
        </Suspense>
    );
}
