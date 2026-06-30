import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: LucideIcon;
    error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, icon: Icon, error, ...props }, ref) => (
        <div className="w-full space-y-1.5">
            {label && (
                <label
                    htmlFor={props.id}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400/80 ml-1"
                >
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400',
                        Icon && 'pl-10',
                        error && 'border-rose-500 focus-visible:ring-rose-500/20 focus-visible:border-rose-500',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
            </div>
            {error && (
                <p className="text-[10px] font-bold text-rose-500 ml-1">{error}</p>
            )}
        </div>
    )
);
Input.displayName = 'Input';

export { Input };
