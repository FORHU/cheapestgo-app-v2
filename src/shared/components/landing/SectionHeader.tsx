"use client";

import React from 'react';
import { useTranslations } from 'next-intl';

interface SectionHeaderProps {
  /** Main heading — accepts rich content (e.g. a highlighted city span). */
  title: React.ReactNode;
  /** Supporting line beneath the title. */
  subtitle?: React.ReactNode;
  /** Whether the "View all" grid is currently expanded. */
  showAll: boolean;
  onToggleShowAll: () => void;
  /** Optional extra controls rendered below the subtitle (e.g. filter pills). */
  children?: React.ReactNode;
  /** Override the bottom margin (defaults to mb-4). */
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  showAll,
  onToggleShowAll,
  children,
  className = 'mb-4',
}) => {
  const t = useTranslations('landing.recentlyViewed');
  return (
  <div className={`flex items-start justify-between ${className}`}>
    <div>
      <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle}
        </p>
      )}
      {children}
    </div>

    <div className="flex items-center gap-2 mt-1">
      <button
        onClick={onToggleShowAll}
        className="text-sm text-blue-500 hover:text-blue-600 font-medium hidden sm:flex items-center gap-0.5 transition-colors"
      >
        {showAll ? t('showLess') : t('viewAll') + ' →'}
      </button>
    </div>
  </div>
  );
};

export default SectionHeader;
