"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Star, Download, ChevronRight } from 'lucide-react';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { useTranslations } from 'next-intl';

const AppBanner = () => {
  const { isInstallable, isIOS, isInstalled, triggerInstall } = usePWAInstall();
  const canInstall = !isInstalled && (isInstallable || isIOS);
  const t = useTranslations('appBanner');

  return (
    <section className="w-full py-3 md:py-6 landscape-compact:py-1">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-6 md:p-8"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
          </div>

          {/* Floating Orbs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-36 h-36 bg-cyan-400/20 rounded-full blur-3xl" />

          <div className="relative flex flex-col gap-4">

            {/* Top row: phone left, text right (mobile) | full row (md+) */}
            <div className="flex flex-row md:flex-row items-center gap-4 md:gap-6">

              {/* Phone Mockup */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative flex-shrink-0"
              >
                <div className="relative w-20 h-36 sm:w-28 sm:h-52 bg-slate-900 rounded-[1.25rem] sm:rounded-[1.75rem] p-1.5 shadow-2xl border border-white/20">
                  <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-[1rem] overflow-hidden">
                    <div className="p-2">
                      <div className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg mb-2" />
                      <div className="space-y-1.5">
                        <div className="h-2.5 bg-white/20 rounded w-3/4" />
                        <div className="h-2.5 bg-white/10 rounded w-1/2" />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <div className="h-10 sm:h-12 bg-white/10 rounded-lg" />
                        <div className="h-10 sm:h-12 bg-white/10 rounded-lg" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-2.5 bg-black rounded-full" />
                </div>

                {/* Floating Badge */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-2 -right-2 px-2 py-1 bg-white rounded-full shadow-lg flex items-center gap-1 z-10"
                >
                  <Star size={11} className="text-amber-500 fill-amber-500" />
                  <span className="text-xs font-bold text-slate-900">4.9</span>
                </motion.div>
              </motion.div>

              {/* Title + Description */}
              <div className="flex-1 text-left">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full mb-2">
                    <Smartphone size={11} className="text-white" />
                    <span className="text-[10px] font-medium text-white">{t('badge')}</span>
                  </div>

                  <h3 className="text-sm sm:text-xl md:text-2xl font-display font-bold text-white mb-1.5 leading-tight">
                    {t('title')}
                  </h3>
                  <p className="text-[11px] sm:text-sm text-white/80 leading-relaxed max-w-md">
                    {t('subtitle')}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Bottom: Stats + Buttons (full width) */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-3"
            >
              {/* Stats */}
              <div className="flex justify-center gap-5">
                <div>
                  <div className="text-base sm:text-xl font-mono font-bold text-white leading-tight">10M+</div>
                  <div className="text-[10px] sm:text-xs text-white/60">{t('downloads')}</div>
                </div>
                <div>
                  <div className="text-base sm:text-xl font-mono font-bold text-white leading-tight">4.9</div>
                  <div className="text-[10px] sm:text-xs text-white/60">{t('rating')}</div>
                </div>
                <div>
                  <div className="text-base sm:text-xl font-mono font-bold text-white leading-tight">15%</div>
                  <div className="text-[10px] sm:text-xs text-white/60">{t('savings')}</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={canInstall ? triggerInstall : undefined}
                  className="flex justify-center items-center gap-1.5 px-4 py-2 bg-white text-slate-900 rounded-xl font-medium shadow-lg w-full sm:w-auto text-sm"
                >
                  <Download size={15} />
                  {canInstall ? t('installBtn') : t('downloadBtn')}
                  <ChevronRight size={13} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex justify-center items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl font-medium border border-white/30 backdrop-blur-sm w-full sm:w-auto text-sm"
                >
                  {t('learnMore')}
                </motion.button>
              </div>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppBanner;
