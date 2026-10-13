"use client";

import React from 'react';

interface TabListProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div
      className={`flex gap-2 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide snap-x snap-mandatory ${className}`}
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-[clamp(0.75rem,1.5vw,0.875rem)] font-medium rounded-full whitespace-nowrap snap-start transition-colors ${
            activeTab === tab
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};
