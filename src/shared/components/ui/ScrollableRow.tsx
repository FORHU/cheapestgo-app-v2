"use client";

import React, { forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableRowProps {
  children: React.ReactNode;
  showNavigation?: boolean;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
  className?: string;
}

export const ScrollableRow = forwardRef<HTMLDivElement, ScrollableRowProps>(
  ({ children, showNavigation = false, onScrollLeft, onScrollRight, className = '' }, ref) => {
    return (
      <div className="relative">
        {showNavigation && (
          <div className="hidden md:flex items-center gap-2 absolute -top-12 right-0">
            <button
              onClick={onScrollLeft}
              className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <button
              onClick={onScrollRight}
              className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        )}
        <div
          ref={ref}
          className={`flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x ${className}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>
      </div>
    );
  }
);

ScrollableRow.displayName = 'ScrollableRow';
