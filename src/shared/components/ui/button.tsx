import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 active:scale-[0.98]',
    {
        variants: {
            variant: {
                default:     'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700',
                destructive: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700',
                outline:     'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10',
                secondary:   'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20',
                ghost:       'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white',
                link:        'text-blue-600 underline-offset-4 hover:underline dark:text-blue-400',
            },
            size: {
                default: 'h-11 px-6',
                sm:      'h-9 rounded-lg px-3 text-xs',
                lg:      'h-12 rounded-xl px-10 text-base',
                icon:    'size-11',
            },
            fullWidth: { true: 'w-full' },
        },
        defaultVariants: {
            variant: 'default',
            size:    'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, fullWidth, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => (
        <button
            className={cn(buttonVariants({ variant, size, fullWidth, className }))}
            ref={ref}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
        </button>
    )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
