'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useSavedStore } from '@/features/landing/stores/saved.store';

interface SaveButtonProps {
    /** Namespaced key, e.g. `flight:MNL-NRT`. */
    itemKey: string;
    label: string;
    className?: string;
}

/**
 * Heart toggle that sits on top of a card link — the click must not navigate,
 * hence the preventDefault/stopPropagation pair.
 */
export function SaveButton({ itemKey, label, className }: SaveButtonProps) {
    const hydrated = useHydrated();
    const persisted = useSavedStore((s) => s.saved.includes(itemKey));
    const toggle = useSavedStore((s) => s.toggle);
    // localStorage isn't known server-side — stay "unsaved" until hydration.
    const saved = hydrated && persisted;

    return (
        <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
            title={saved ? 'Saved' : 'Save'}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(itemKey);
            }}
            className={cn(
                'absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm',
                'flex items-center justify-center transition-transform hover:scale-[1.08] active:scale-[0.92]',
                className
            )}
        >
            <Heart
                size={16}
                strokeWidth={2}
                className={cn(
                    'transition-colors',
                    saved ? 'fill-blue-600 text-blue-600' : 'text-slate-900 dark:text-white'
                )}
            />
        </button>
    );
}
