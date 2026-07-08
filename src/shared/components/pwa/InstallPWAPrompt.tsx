"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share, Plus, ArrowDownToLine } from 'lucide-react';
import Image from 'next/image';
import { usePWAInstall } from '@/contexts/PWAInstallContext';

const IOS_STEPS = [
  {
    number: 1,
    title: 'Tap the Share button',
    description: 'Find the share icon at the bottom of your Safari browser',
    Icon: Share,
  },
  {
    number: 2,
    title: 'Scroll down the menu',
    description: 'Scroll through the share sheet options',
    Icon: ArrowDownToLine,
  },
  {
    number: 3,
    title: 'Tap "Add to Home Screen"',
    description: 'Look for the icon with a plus symbol',
    Icon: Plus,
  },
  {
    number: 4,
    title: 'Tap "Add" to confirm',
    description: 'CheapestGo will appear on your home screen',
    Icon: Download,
  },
] as const;

export default function InstallPWAPrompt() {
  const { isInstalled, isGuideOpen, closeGuide } = usePWAInstall();

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {isGuideOpen && (
        <>
          <motion.div
            key="guide-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
            onClick={closeGuide}
          />

          <motion.div
            key="guide-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            <div className="px-6 pb-8 pt-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5">
                    <Image
                      src="/cheapestgo.png"
                      alt="CheapestGo"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                      Add to Home Screen
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">CheapestGo · iOS Safari</p>
                  </div>
                </div>
                <button
                  onClick={closeGuide}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="Close guide"
                >
                  <X size={18} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {IOS_STEPS.map(({ number, title, description, Icon }) => (
                  <motion.div
                    key={number}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: number * 0.07 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{number}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                    </div>

                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Icon size={16} className="text-slate-600 dark:text-slate-400" />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2.5 p-3.5 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                <Share size={15} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-snug">
                  Tap the{' '}
                  <span className="font-semibold">
                    <Share size={11} className="inline mb-0.5" /> Share
                  </span>{' '}
                  icon at the bottom center of Safari to get started
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
